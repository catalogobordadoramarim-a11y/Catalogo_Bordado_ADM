// Configuração pública do Firebase Web - Catálogo Bordado
// Pode ser versionada no front-end. Não contém senha nem chave privada.
export const firebaseConfig = {
  apiKey: "AIzaSyCUIE5COlcm83NCOVlRIM9JkLFaWOJX4XU",
  authDomain: "catalogobordado-c8115.firebaseapp.com",
  projectId: "catalogobordado-c8115",
  storageBucket: "catalogobordado-c8115.firebasestorage.app",
  messagingSenderId: "514717912011",
  appId: "1:514717912011:web:ca6c2fc4ceff4cd466044e"
};

export const firebaseReady = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);
