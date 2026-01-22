
import { getClosestAspectRatio } from '../lib/gemini.ts';

const runTest = () => {
    const testCases = [
        { w: 1480, h: 716, expected: '21:9' },   // 2.067 is closer to 2.33 (21:9) or 1.77 (16:9)? 
        // 2.33-2.06=0.27. 2.06-1.77=0.29. 
        // Actually strictly 21:9 might be closer now! Let's calculate.
        { w: 1920, h: 1080, expected: '16:9' },
        { w: 1080, h: 1920, expected: '9:16' },
        { w: 1000, h: 1000, expected: '1:1' },
        { w: 1000, h: 1250, expected: '4:5' },   // Explicit 4:5
        { w: 1200, h: 800, expected: '3:2' },    // 1.5
        { w: 1000, h: 1500, expected: '2:3' },   // 0.666
    ];

    console.log("🧪 Running Extended Aspect Ratio Tests...\n");

    let passed = 0;
    testCases.forEach((tc, idx) => {
        const result = getClosestAspectRatio(tc.w, tc.h);
        const pass = result === tc.expected;
        if (pass) passed++;

        console.log(`Test #${idx + 1}: ${tc.w}x${tc.h}`);
        console.log(`  Ratio: ${(tc.w / tc.h).toFixed(2)}`);
        console.log(`  Expect: ${tc.expected}`);
        console.log(`  Got:    ${result}`);
        console.log(`  Status: ${pass ? '✅ PASS' : '❌ FAIL'}`);

        // Debug logic if fail
        if (!pass) {
            // ... debug info
        }
    });

    console.log(`\nResult: ${passed}/${testCases.length} Passed`);

    if (passed === testCases.length) {
        console.log("\n✨ All checks passed.");
    } else {
        console.error("\n⚠️ Failed.");
        process.exit(1);
    }
};

runTest();
