// Configuração pública do Cloudinary para upload unsigned.
// NÃO colocar API Secret neste arquivo.
export const cloudinaryConfig = {
  cloudName: "l1cs05wn",
  unsignedUploadPreset: "Catalogo_Bordado",
  folder: "catalogo-bordado"
};

export const cloudinaryReady = Boolean(
  cloudinaryConfig.cloudName &&
  cloudinaryConfig.unsignedUploadPreset
);
