import cliProgress from "cli-progress";
import people from "./data.json" assert { type: "json" };
import fs from "fs";

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);


bar.start(people.length, 0);

const fileNames = people.reduce((acc, { id: unformmattedId, name }, index) => {

    const id = unformmattedId.length === 10 ?
        unformmattedId :
        "0" + unformmattedId;

    const currentName = `Titulo_${id}.pdf`;
    const newName = `${name}.pdf`;

    acc[currentName] = newName;

    bar.update(index + 1);
    return acc;

}, {});

fs.writeFile('names.json', JSON.stringify(fileNames, null, 2), 'utf8', (err) => {
    if (err) {
        console.error('Error saving file:', err);
        return;
    }
    console.log('JSON file has been saved.');
});

bar.stop();
