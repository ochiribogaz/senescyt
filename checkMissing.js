import fs from "fs";
import names from "./names.json" assert { type: "json" };
import path from "path";

export const folderPath = path.resolve('./certificados');

const existingFiles = fs.readdirSync(folderPath);

const fileNames = Object.keys(names);

const missingFiles = fileNames
    .filter(fileName => !existingFiles.includes(fileName))
    .map((fileName, i) => (i+1) + ". " + names[fileName].replace(".pdf", ""))
    .join("\n")

console.log(missingFiles);