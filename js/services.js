import { firebaseConfig, firebaseReady } from "./firebase-config.js";
import { cloudinaryConfig, cloudinaryReady } from "./cloudinary-config.js";

let firebaseModules = null;

async function getFirebase() {
  if (!firebaseReady) return null;
  if (firebaseModules) return firebaseModules;
  const appMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  const fsMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");
  const authMod = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
  const app = appMod.initializeApp(firebaseConfig);
  const db = fsMod.getFirestore(app);
  const auth = authMod.getAuth(app);
  await authMod.setPersistence(auth, authMod.browserLocalPersistence);
  firebaseModules = { app, db, auth, fsMod, authMod };
  return firebaseModules;
}

function normalizeCode(value="") { return String(value).replace(/\D/g, ""); }
function lineFromModel(model="") { const code=normalizeCode(model); return code ? code.slice(0,-1)+"0" : ""; }
function clampRepetition(value){ const n=Math.round(Number(value)||1); return Math.min(5,Math.max(1,n)); }
function toIso(v){ if(!v) return null; if(typeof v.toDate === "function") return v.toDate().toISOString(); if(v instanceof Date) return v.toISOString(); return String(v); }
function fromDoc(d){
  const x=d.data();
  return {
    id:d.id,
    name:x.name || `modelo-${x.codigo||d.id}`,
    code:x.codigo || x.code || d.id,
    line:x.linha || lineFromModel(x.codigo || x.code || d.id),
    type:x.situacao || x.type || "ESTIMADO",
    repetition:clampRepetition(x.repeticaoJogoGabarito ?? x.repeticaoGabarito ?? x.repetition),
    origin:x.origem || x.origin || "Manual",
    status:x.publicada === false || x.status === "Rascunho" ? "Rascunho" : "Publicada",
    stages:Array.isArray(x.etapas)?x.etapas:(Array.isArray(x.stages)?x.stages:[]),
    image:x.fotoUrl || x.image || "",
    imagePublicId:x.fotoPublicId || x.imagePublicId || "",
    createdAt:toIso(x.createdAt),
    updatedAt:toIso(x.updatedAt)
  };
}

async function login(email,password){
  const fb=await getFirebase();
  if(!fb) throw new Error("Firebase ainda não configurado.");
  return fb.authMod.signInWithEmailAndPassword(fb.auth,String(email||"").trim(),password);
}
async function logout(){ const fb=await getFirebase(); if(fb) return fb.authMod.signOut(fb.auth); }
async function resetPassword(email){
  const fb=await getFirebase(); if(!fb) throw new Error("Firebase ainda não configurado.");
  return fb.authMod.sendPasswordResetEmail(fb.auth,String(email||"").trim());
}
async function onAuthChanged(callback){
  const fb=await getFirebase(); if(!fb){ callback(null); return ()=>{}; }
  return fb.authMod.onAuthStateChanged(fb.auth,callback);
}
async function getUserProfile(uid){
  const fb=await getFirebase(); if(!fb || !uid) return null;
  const snap=await fb.fsMod.getDoc(fb.fsMod.doc(fb.db,"usuarios",uid));
  return snap.exists()?{uid,...snap.data()}:null;
}
async function requireAdmin(){
  const fb=await getFirebase();
  if(!fb?.auth?.currentUser) throw new Error("Faça login para continuar.");
  const profile=await getUserProfile(fb.auth.currentUser.uid);
  if(!profile || profile.ativo!==true || profile.role!=="admin") throw new Error("Usuário sem permissão de administrador.");
  return {user:fb.auth.currentUser,profile};
}


function userStatus(x){if(x.role==="admin")return "Administrador";if(x.ativo===true)return "Aprovado";if(x.status==="recusado")return "Recusado";return "Pendente";}
async function listUsers(){
  await requireAdmin();
  const fb=await getFirebase();
  const snap=await fb.fsMod.getDocs(fb.fsMod.collection(fb.db,"usuarios"));
  return snap.docs.map(d=>{const x=d.data();return {uid:d.id,nome:x.nome||"",email:x.email||"",role:x.role||"cliente",ativo:x.ativo===true,status:x.status||"",displayStatus:userStatus(x),dataSolicitacao:toIso(x.dataSolicitacao),dataAprovacao:toIso(x.dataAprovacao)};}).sort((a,b)=>{if(a.displayStatus!==b.displayStatus)return a.displayStatus.localeCompare(b.displayStatus);return (a.nome||a.email).localeCompare(b.nome||b.email);});
}
async function approveUser(uid){
  await requireAdmin();const fb=await getFirebase();
  await fb.fsMod.setDoc(fb.fsMod.doc(fb.db,"usuarios",uid),{role:"cliente",ativo:true,status:"aprovado",dataAprovacao:fb.fsMod.serverTimestamp(),dataAtualizacao:fb.fsMod.serverTimestamp()},{merge:true});
}
async function rejectUser(uid){
  await requireAdmin();const fb=await getFirebase();
  await fb.fsMod.setDoc(fb.fsMod.doc(fb.db,"usuarios",uid),{role:"cliente",ativo:false,status:"recusado",dataAtualizacao:fb.fsMod.serverTimestamp()},{merge:true});
}

async function listAllModels(){
  await requireAdmin();
  const fb=await getFirebase();
  const snap=await fb.fsMod.getDocs(fb.fsMod.collection(fb.db,"fichas"));
  return snap.docs.map(fromDoc).sort((a,b)=>normalizeCode(a.code).localeCompare(normalizeCode(b.code),undefined,{numeric:true}));
}
async function listPublishedModels(){
  await requireAdmin();
  const fb=await getFirebase();
  const q=fb.fsMod.query(fb.fsMod.collection(fb.db,"fichas"),fb.fsMod.where("publicada","==",true));
  const snap=await fb.fsMod.getDocs(q);
  return snap.docs.map(fromDoc).sort((a,b)=>normalizeCode(a.code).localeCompare(normalizeCode(b.code),undefined,{numeric:true}));
}
async function saveModel(model,options={}){
  await requireAdmin();
  const fb=await getFirebase();
  const code=normalizeCode(model.codigo || model.code); if(!code) throw new Error("Modelo sem código.");
  const ref=fb.fsMod.doc(fb.db,"fichas",code);
  const existing=await fb.fsMod.getDoc(ref);
  if(existing.exists() && options.allowOverwrite === false){
    throw new Error(`Modelo ${code} já cadastrado. Use Atualizar para alterar a ficha existente.`);
  }
  const payload={
    codigo:code,
    linha:model.linha || model.line || lineFromModel(code),
    situacao:model.situacao || model.type || "ESTIMADO",
    repeticaoJogoGabarito:clampRepetition(model.repeticaoJogoGabarito ?? model.repeticaoGabarito ?? model.repetition),
    origem:model.origem || model.origin || "Manual",
    status:model.status || (model.publicada===false?"Rascunho":"Publicada"),
    publicada:model.publicada ?? (model.status !== "Rascunho"),
    etapas:Array.isArray(model.etapas)?model.etapas:(Array.isArray(model.stages)?model.stages:[]),
    fotoUrl:model.fotoUrl || model.image || "",
    fotoPublicId:model.fotoPublicId || model.imagePublicId || "",
    name:model.name || `modelo-${code}`,
    updatedAt:fb.fsMod.serverTimestamp()
  };
  if(!existing.exists()) payload.createdAt=fb.fsMod.serverTimestamp();
  await fb.fsMod.setDoc(ref,payload,{merge:true});
  return payload;
}
async function deleteModel(code){
  await requireAdmin();
  const fb=await getFirebase();
  await fb.fsMod.deleteDoc(fb.fsMod.doc(fb.db,"fichas",normalizeCode(code)));
}
async function uploadImage(file,modelCode=""){
  await requireAdmin();
  if(!cloudinaryReady) throw new Error("Cloudinary ainda não configurado.");
  if(!file) throw new Error("Selecione uma imagem.");
  const form=new FormData();
  form.append("file",file); form.append("upload_preset",cloudinaryConfig.unsignedUploadPreset);
  form.append("folder",cloudinaryConfig.folder);
  if(modelCode) form.append("public_id",normalizeCode(modelCode));
  const endpoint=`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
  const response=await fetch(endpoint,{method:"POST",body:form});
  const json=await response.json();
  if(!response.ok) throw new Error(json?.error?.message || "Falha no upload da imagem.");
  return {url:json.secure_url,publicId:json.public_id,width:json.width,height:json.height,bytes:json.bytes};
}

export const appServices={firebaseReady,cloudinaryReady,listAllModels,listPublishedModels,listUsers,approveUser,rejectUser,saveModel,deleteModel,uploadImage,login,logout,resetPassword,onAuthChanged,getUserProfile,requireAdmin,normalizeCode,lineFromModel};
