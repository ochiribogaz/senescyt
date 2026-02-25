import { createInterface } from 'readline/promises';
import { retrieveImpediments, consolidateCertificates } from './retrieveImpediments.js';
import { calculateBrowserCount } from './utils/browserResources.js';
import people from './impedimentsCari.json' assert { type: 'json' };

const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = (question) => rl.question(question).then(a => a.trim());

const batchPeople = (arr, n) => {
    const size = Math.ceil(arr.length / n);
    return Array.from({ length: n }, (_, i) => arr.slice(i * size, (i + 1) * size))
        .filter(batch => batch.length > 0);
};

(async () => {
    try {
        const { cpuCount, totalMemoryGB, freeMemoryGB, recommended } =
            calculateBrowserCount(people.length);

        console.log('\n--- System Info ---');
        console.log(`CPUs:        ${cpuCount}`);
        console.log(`Total RAM:   ${totalMemoryGB} GB`);
        console.log(`Free RAM:    ${freeMemoryGB} GB`);
        console.log('-------------------');
        console.log(`People to process:   ${people.length}`);
        console.log(`Recommended browsers: ${recommended}`);

        let browserCount;
        const confirm = await ask(`\nUse ${recommended} browser(s)? (y/n): `);

        if (confirm.toLowerCase() === 'y') {
            browserCount = recommended;
        } else {
            const input = await ask('Enter number of browsers: ');
            browserCount = Math.max(1, parseInt(input, 10) || 1);
        }

        rl.close();

        const batches = batchPeople(people, browserCount);

        console.log(`\nStarting ${batches.length} browser(s) — ${batches.map(b => b.length).join(', ')} people each...\n`);

        const batchResults = await Promise.all(
            batches.map(batch => retrieveImpediments({ people: batch }))
        );

        const allResults = batchResults.flatMap(r => r.results);
        const allErrors  = batchResults.flatMap(r => r.errors);

        console.log(`\nConsolidating ${allResults.length} certificate(s)...`);
        consolidateCertificates(allResults);

        if (allErrors.length) {
            console.error(`\n${allErrors.length} error(s):`);
            allErrors.forEach(({ person, error }) =>
                console.error(`  [${person.id}] ${error.message}`)
            );
        }

        console.log('\nDone.');
    } catch (error) {
        rl.close();
        console.error(error);
    }
})();
