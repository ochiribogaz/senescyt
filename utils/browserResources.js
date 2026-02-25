import os from 'os';

// macOS reports near-zero freemem because it counts file cache as used.
// Using 50% of total RAM is a more realistic estimate of what's available.
const MEMORY_AVAILABLE_FACTOR = 0.5;
const RAM_PER_BROWSER_GB = 1.5;  // ~1.5 GB per Chromium instance
const CORES_PER_BROWSER = 2;

export const calculateBrowserCount = (peopleCount) => {
    const cpuCount = os.cpus().length;
    const totalMemoryGB = os.totalmem() / (1024 ** 3);
    const availableMemoryGB = totalMemoryGB * MEMORY_AVAILABLE_FACTOR;

    const browsersByMemory = Math.floor(availableMemoryGB / RAM_PER_BROWSER_GB);
    const browsersByCpu = Math.floor(cpuCount / CORES_PER_BROWSER);

    const recommended = Math.max(1, Math.min(browsersByMemory, browsersByCpu, peopleCount));

    return {
        cpuCount,
        totalMemoryGB: Number(totalMemoryGB.toFixed(1)),
        availableMemoryGB: Number(availableMemoryGB.toFixed(1)),
        recommended,
    };
};
