import Tesseract from 'tesseract.js';
import sharp from "sharp";

export const getSenescytCodeFromImg = async ({
    codeImgBuffer,
    lang = 'eng',
    imgName,
}) => {

    const senescytCodeBuffer = await sharp(Buffer.from(codeImgBuffer))
        .extend({
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
            background: { r: 0, g: 0, b: 0 },
        })
        //.threshold(128) // Umbral para convertir los píxeles no negros en blanco
        .toBuffer();

    if (imgName) {
        const imagePath = `./${imgName}.png`;
        await sharp(senescytCodeBuffer).toFile(imagePath);
    }

    const {
        data: {
            text: senescytCode
        }
    } = await Tesseract.recognize(senescytCodeBuffer, lang);


    return senescytCode;

}