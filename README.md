# Catálogo Bordado ADM

Painel administrativo PWA para cadastro, importação, atualização e publicação de fichas.

## Stack
- HTML / CSS / JavaScript
- Firebase Authentication + Firestore
- Cloudinary para fotos
- PWA (manifest + service worker)
- SheetJS/JSZip para importação Excel no protótipo

## Segurança
Nunca versionar:
- senha de usuário
- API Secret do Cloudinary
- service-account JSON do Firebase
- chaves privadas

Os arquivos `js/firebase-config.js` e `js/cloudinary-config.js` recebem apenas configuração pública do navegador.
