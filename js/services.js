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

  firebaseModules = { app, db, auth, fsMod, authMod };
  return firebaseModules;
}

function normalizeCode(value="") {
  return String(value).replace(/\D/g, "");
}

function lineFromModel(model="") {
  const code = normalizeCode(model);
  if (!code) return "";
  return code.slice(0, -1) + "0";
}

async function listPublishedModels() {
  const fb = await getFirebase();
  if (!fb) return [];
  const { db, fsMod } = fb;
  const q = fsMod.query(
    fsMod.collection(db, "fichas"),
    fsMod.where("publicada", "==", true)
  );
  const snap = await fsMod.getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function saveModel(model) {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase ainda não configurado.");
  const { db, fsMod } = fb;

  const code = normalizeCode(model.codigo || model.code);
  if (!code) throw new Error("Modelo sem código.");

  const payload = {
    ...model,
    codigo: code,
    linha: model.linha || lineFromModel(code),
    updatedAt: fsMod.serverTimestamp()
  };

  await fsMod.setDoc(fsMod.doc(db, "fichas", code), payload, { merge: true });
  return payload;
}

async function deleteModel(code) {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase ainda não configurado.");
  const { db, fsMod } = fb;
  await fsMod.deleteDoc(fsMod.doc(db, "fichas", normalizeCode(code)));
}

async function uploadImage(file, modelCode="") {
  if (!cloudinaryReady) throw new Error("Cloudinary ainda não configurado.");
  if (!file) throw new Error("Selecione uma imagem.");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", cloudinaryConfig.unsignedUploadPreset);
  form.append("folder", cloudinaryConfig.folder);
  if (modelCode) form.append("public_id", normalizeCode(modelCode));

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
  const response = await fetch(endpoint, { method: "POST", body: form });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || "Falha no upload da imagem.");
  return {
    url: json.secure_url,
    publicId: json.public_id,
    width: json.width,
    height: json.height,
    bytes: json.bytes
  };
}

async function login(email, password) {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase ainda não configurado.");
  return fb.authMod.signInWithEmailAndPassword(fb.auth, email, password);
}

async function logout() {
  const fb = await getFirebase();
  if (!fb) return;
  return fb.authMod.signOut(fb.auth);
}

export const appServices = {
  firebaseReady,
  cloudinaryReady,
  listPublishedModels,
  saveModel,
  deleteModel,
  uploadImage,
  login,
  logout,
  normalizeCode,
  lineFromModel
};
