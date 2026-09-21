// Routing Number validation ( MOD 10 )

const WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1] as const;

export function isValidRoutingNumber(routingNumber: string): boolean {
    // Must be exactly 9 digits
    if (!/^\d{9}$/.test(routingNumber)) {
        return false;
    }

    // MOD-10 check

    let sum = 0;

    for (let i = 0; i < 9; i++) {
        const digit = parseInt(routingNumber.charAt(i), 10);
        sum += digit * WEIGHTS[i]!;
    }

    // sum must be exactly divisble by 10 and greater then 0

    return sum > 0 && sum % 10 === 0;
}

// Simple routing number lookup — maps routing numbers to bank names.
// In production, use the Federal Reserve's E-Payments Routing Directory.
// For MVP, a curated list of the most common US banks.
const KNOWN_BANKS: Record<string, { name: string; city: string; state: string }> = {
    "111000025": { name: "JPMorgan Chase Bank, N.A.", city: "New York", state: "NY" },
    "021000021": { name: "JPMorgan Chase Bank, N.A.", city: "New York", state: "NY" },
    "322271627": { name: "Wells Fargo Bank, N.A.", city: "San Francisco", state: "CA" },
    "121000248": { name: "Wells Fargo Bank, N.A.", city: "San Francisco", state: "CA" },
    "021000089": { name: "Citibank, N.A.", city: "New York", state: "NY" },
    "026009593": { name: "Bank of America, N.A.", city: "Charlotte", state: "NC" },
    "011401533": { name: "TD Bank, N.A.", city: "Wilmington", state: "DE" },
    "031000503": { name: "HSBC Bank USA, N.A.", city: "New York", state: "NY" },
    // Add more as needed — or load from a JSON file / database table
};

export interface BankAccountResult {
    valid: boolean;
    bankName?: string;
    city?: string;
    state?: string;
    error?: string
}

export function lookupRoutingNumber(routingNumber: string): BankAccountResult {

    if (!isValidRoutingNumber(routingNumber)) {
        return {
            valid: false,
            error: "Invalid routing number (failed MOD-10 checksum)"
        };
    }

    const bank = KNOWN_BANKS[routingNumber];

    if (bank) {
        return {
            valid: true,
            bankName: bank.name,
            city: bank.city,
            state: bank.state
        }
    }

    // Routing number passes MOD-10 but is not in our lookup table.
    // It might be a valid routing number for a smaller bank.
    return {
        valid: true,
        bankName: "Unknown Bank",
        city: undefined,
        state: undefined,
    };
}
