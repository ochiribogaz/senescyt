export const fnWithRetry = (
    fn,
    retries = 2,
    getRetryCondition = (error) => true,
) => async (...args) => {
    let attempts = 0
    while (true) {
        try {
            return await fn(...args);
        }
        catch (error) {
            const retryAgain = getRetryCondition(error);
            if (attempts >= retries || !retryAgain) {
                throw error;
            }
            attempts++;
        }
    }
}