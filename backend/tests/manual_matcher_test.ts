
import { ResultMatcher, MatcherContext, CandidateResult, MatchConfidence } from '../src/utils/result-matcher';
import { AccommodationType } from '../src/entities/HolidayProfile';

console.log('🧪 Testing ResultMatcher Logic...\n');

const context: MatcherContext = {
    targetData: {
        dateStart: '2024-07-01',
        nights: 7,
        party: { adults: 2, children: 2 },
        pets: false,
        accommodationType: AccommodationType.CARAVAN,
        minBedrooms: 2
    }
};

const scenarios: { name: string, result: CandidateResult, expected: MatchConfidence }[] = [
    {
        name: 'Perfect Match',
        result: {
            stayStartDate: '2024-07-01',
            stayNights: 7,
            priceTotalGbp: 500,
            availability: 'AVAILABLE',
            bedrooms: 2,
            petsAllowed: false
        },
        expected: MatchConfidence.STRONG
    },
    {
        name: 'Date Mismatch',
        result: {
            stayStartDate: '2024-07-02', // Wrong date
            stayNights: 7,
            priceTotalGbp: 500,
            availability: 'AVAILABLE',
            bedrooms: 2,
            petsAllowed: false
        },
        expected: MatchConfidence.MISMATCH
    },
    {
        name: 'Nights Mismatch',
        result: {
            stayStartDate: '2024-07-01',
            stayNights: 3, // Wrong nights
            priceTotalGbp: 500,
            availability: 'AVAILABLE',
            bedrooms: 2,
            petsAllowed: false
        },
        expected: MatchConfidence.MISMATCH
    },
    {
        name: 'Pets Mismatch (User has pets, place does not)',
        result: {
            stayStartDate: '2024-07-01',
            stayNights: 7,
            priceTotalGbp: 500,
            availability: 'AVAILABLE',
            bedrooms: 2,
            petsAllowed: false
        },
        expected: MatchConfidence.MISMATCH
    },
    {
        name: 'Unknown Bedrooms (Critical missing data)',
        result: {
            stayStartDate: '2024-07-01',
            stayNights: 7,
            priceTotalGbp: 500,
            availability: 'AVAILABLE',
            petsAllowed: false
            // bedrooms undefined
        },
        expected: MatchConfidence.UNKNOWN
    },
    {
        name: 'Too Few Bedrooms',
        result: {
            stayStartDate: '2024-07-01',
            stayNights: 7,
            priceTotalGbp: 500,
            availability: 'AVAILABLE',
            bedrooms: 1, // < 2
            petsAllowed: false
        },
        expected: MatchConfidence.MISMATCH
    }
];

// Context for Pet scenario
const petContext: MatcherContext = {
    ...context,
    targetData: { ...context.targetData, pets: true }
};

let passed = 0;
let failed = 0;

scenarios.forEach(scenario => {
    // Swap context for pet scenario
    const testContext = scenario.name.includes('Pets Mismatch') ? petContext : context;

    const outcome = ResultMatcher.classify(scenario.result, testContext);

    if (outcome.confidence === scenario.expected) {
        console.log(`✅ ${scenario.name}: Got ${outcome.confidence}`);
        passed++;
    } else {
        console.error(`❌ ${scenario.name}: Expected ${scenario.expected}, got ${outcome.confidence} (${outcome.description})`);
        failed++;
    }
});

console.log(`\nResults: ${passed} Passed, ${failed} Failed`);

if (failed > 0) throw new Error('Tests failed');
