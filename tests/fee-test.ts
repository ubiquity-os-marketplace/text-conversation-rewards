/**
 * Test fee calculation logic
 */

import Decimal from "decimal.js";

// Mock env
const env = {
  PERMIT_FEE_RATE: "10", // 10%
  PERMIT_TREASURY_GITHUB_USERNAME: "ubiquity-os-treasury",
  PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST: "",
};

// Mock result
const mockResult = {
  "user1": {
    total: 100,
    task: { reward: 80 },
    comments: [{ score: { reward: 20 } }],
    userId: 1,
  },
  "user2": {
    total: 50,
    task: { reward: 40 },
    comments: [{ score: { reward: 10 } }],
    userId: 2,
  },
};

function deductFeeFromReward(result: any) {
  const feeRateDecimal = new Decimal(100).minus(env.PERMIT_FEE_RATE).div(100);
  let permitFeeAmountDecimal = new Decimal(0);
  
  for (const [key, rewardResult] of Object.entries(result)) {
    // accumulate total permit fee amount
    const totalAfterFee = new Decimal(rewardResult.total).mul(feeRateDecimal).toNumber();
    permitFeeAmountDecimal = permitFeeAmountDecimal.add(new Decimal(rewardResult.total).minus(totalAfterFee));
    
    // subtract fees
    result[key].total = Number(totalAfterFee.toFixed(2));
    result[key].feeRate = feeRateDecimal.toNumber();
    
    if (result[key].task) {
      result[key].task.reward = Number(new Decimal(result[key].task.reward).mul(feeRateDecimal).toFixed(2));
    }
    
    if (result[key].comments) {
      for (const comment of result[key].comments) {
        if (comment.score) {
          comment.score.reward = Number(new Decimal(comment.score.reward).mul(feeRateDecimal).toFixed(2));
        }
      }
    }
  }

  // Add a new result item for treasury
  result[env.PERMIT_TREASURY_GITHUB_USERNAME] = {
    total: Number(permitFeeAmountDecimal.toFixed(2)),
    userId: 999,
  };

  return result;
}

// Test
console.log("Before fee deduction:");
console.log(JSON.stringify(mockResult, null, 2));

const result = deductFeeFromReward(mockResult);

console.log("\nAfter fee deduction:");
console.log(JSON.stringify(result, null, 2));

// Verify
console.log("\n✅ Verification:");
console.log(`User1 total: ${result.user1.total} (expected: 90)`);
console.log(`User2 total: ${result.user2.total} (expected: 45)`);
console.log(`Treasury total: ${result["ubiquity-os-treasury"].total} (expected: 15)`);
console.log(`Total: ${result.user1.total + result.user2.total + result["ubiquity-os-treasury"].total} (expected: 150)`);
