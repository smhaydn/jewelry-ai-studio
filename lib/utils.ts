export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // RESIZE LOGIC: Max 1536px (High enough for details, small enough for speed)
        const MAX_SIZE = 1536;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // COMPRESS: JPEG at 85% quality is visually lossless for AI but 10x smaller
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = (err) => reject(new Error('Image load failed'));
    };
    reader.onerror = error => reject(error);
  });
};

export const downloadImage = (base64Data: string, filename: string) => {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64Data}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};