import path from "path";
import fs from "fs";
import fileNames from "./fileNames.json" assert { type: "json" };


export const folderPath = path.resolve('./certificados-nombre');

fs.readdir(folderPath, (err, files) => {
  if (err) {
    console.error('Error al leer la carpeta:', err);
    return;
  }

  files.forEach((file, index) => {
    const oldPath = path.join(folderPath, file);
    const newName = fileNames[file];
    const newPath = path.join(folderPath, newName);

    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        console.error(`Error al renombrar ${file}:`, err);
      } else {
        console.log(`${file} renombrado a ${newName}`);
      }
    });
  });
});