
export class LocationNotFoundError extends Error {
    constructor(public location: string, public provider: string) {
        super(`Location "${location}" not found for provider ${provider}`);
        this.name = 'LocationNotFoundError';
    }
}
