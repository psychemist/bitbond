import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;

describe("BitBond Escrow Contract Tests", () => {
  it("ensures simnet is well initialized", () => {
    expect(simnet.blockHeight).toBeDefined();
  });

  // ✅ PASSING: Core functionality tests
  it("can create a new task successfully", () => {
    const { result } = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Learn Clarity"),
      Cl.stringAscii("Complete the Clarity tutorial by Friday"),
      Cl.uint(1000000), // 1 STX in microSTX
      Cl.uint(1000) // Future deadline
    ], address1);
    
    expect(result).toBeOk(Cl.uint(1));
    console.log("✅ Task creation successful - returned task ID:", result);
  });

  // ✅ PASSING: Security validation tests
  it("cannot create task with same user as buddy", () => {
    const { result } = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address1), // Same as creator
      Cl.stringAscii("Self task"),
      Cl.stringAscii("This should fail"),
      Cl.uint(1000000),
      Cl.uint(1000)
    ], address1);
    
    expect(result).toBeErr(Cl.uint(107)); // err-same-user
    console.log("✅ Security check passed - prevented self-buddy assignment");
  });

  it("cannot create task with invalid deadline", () => {
    const { result } = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Past task"),
      Cl.stringAscii("This deadline is in the past"),
      Cl.uint(1000000),
      Cl.uint(1) // Past deadline
    ], address1);
    
    expect(result).toBeErr(Cl.uint(108)); // err-invalid-deadline
    console.log("✅ Security check passed - prevented invalid deadline");
  });

  it("cannot create task with zero stake", () => {
    const { result } = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Zero stake"),
      Cl.stringAscii("No stake amount"),
      Cl.uint(0), // Zero stake
      Cl.uint(1000)
    ], address1);
    
    expect(result).toBeErr(Cl.uint(103)); // err-invalid-amount
    console.log("✅ Security check passed - prevented zero stake");
  });

  // ✅ PASSING: Verification functionality
  it("buddy can verify task as successful", () => {
    // Create task first
    const createResult = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Complete workout"),
      Cl.stringAscii("30 minute workout session"),
      Cl.uint(1000000),
      Cl.uint(1000)
    ], address1);
    
    expect(createResult.result).toBeOk(Cl.uint(1));
    
    // Get balance before verification
    const balanceBefore = simnet.getAssetsMap().get("STX")?.get(address1) || 0n;
    console.log("Balance before verification:", balanceBefore);
    
    // Buddy verifies task as successful
    const verifyResult = simnet.callPublicFn("bitbond-escrow", "verify-task", [
      Cl.uint(1),
      Cl.bool(true) // Success
    ], address2);
    
    expect(verifyResult.result).toBeOk(Cl.bool(true));
    
    // Check balance after verification (should have increased)
    const balanceAfter = simnet.getAssetsMap().get("STX")?.get(address1) || 0n;
    console.log("Balance after verification:", balanceAfter);
    console.log("✅ Task verification successful - funds returned to creator");
    
    // Verify balance increased by stake amount
    expect(balanceAfter).toEqual(balanceBefore + 1000000n);
  });

  it("buddy can verify task as failed", () => {
    const createResult = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Daily exercise"),
      Cl.stringAscii("Exercise for 1 hour"),
      Cl.uint(2000000), // 2 STX
      Cl.uint(1000)
    ], address1);
    
    expect(createResult.result).toBeOk(Cl.uint(1));
    
    const balanceBefore = simnet.getAssetsMap().get("STX")?.get(address1) || 0n;
    
    // Buddy verifies task as failed
    const verifyResult = simnet.callPublicFn("bitbond-escrow", "verify-task", [
      Cl.uint(1),
      Cl.bool(false) // Failed
    ], address2);
    
    expect(verifyResult.result).toBeOk(Cl.bool(false));
    
    const balanceAfter = simnet.getAssetsMap().get("STX")?.get(address1) || 0n;
    console.log("✅ Failed task verification - stake correctly forfeited");
    
    // Balance should remain the same (no refund for failed task)
    expect(balanceAfter).toEqual(balanceBefore);
  });

  // ✅ PASSING: Authorization tests
  it("only assigned buddy can verify task", () => {
    const createResult = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Read book"),
      Cl.stringAscii("Finish reading the assigned book"),
      Cl.uint(1000000),
      Cl.uint(1000)
    ], address1);
    
    expect(createResult.result).toBeOk(Cl.uint(1));
    
    // Unauthorized user tries to verify
    const verifyResult = simnet.callPublicFn("bitbond-escrow", "verify-task", [
      Cl.uint(1),
      Cl.bool(true)
    ], address3);
    
    expect(verifyResult.result).toBeErr(Cl.uint(102)); // err-unauthorized
    console.log("✅ Authorization check passed - prevented unauthorized verification");
  });

  it("cannot verify task twice", () => {
    const createResult = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Write essay"),
      Cl.stringAscii("Write 1000 word essay"),
      Cl.uint(1000000),
      Cl.uint(1000)
    ], address1);
    
    expect(createResult.result).toBeOk(Cl.uint(1));
    
    // First verification
    const firstVerify = simnet.callPublicFn("bitbond-escrow", "verify-task", [
      Cl.uint(1),
      Cl.bool(true)
    ], address2);
    
    expect(firstVerify.result).toBeOk(Cl.bool(true));
    
    // Try to verify again
    const secondVerify = simnet.callPublicFn("bitbond-escrow", "verify-task", [
      Cl.uint(1),
      Cl.bool(false)
    ], address2);
    
    expect(secondVerify.result).toBeErr(Cl.uint(105)); // err-task-already-verified
    console.log("✅ Double verification prevented - task immutable after verification");
  });

  // ✅ PASSING: Expiration and reclaim tests
  it("creator can reclaim stake from expired unverified task", () => {
    const currentHeight = simnet.blockHeight;
    
    const createResult = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Short deadline"),
      Cl.stringAscii("Task with short deadline"),
      Cl.uint(1000000),
      Cl.uint(currentHeight + 10) // 10 blocks from now
    ], address1);
    
    expect(createResult.result).toBeOk(Cl.uint(1));
    
    // Mine blocks to pass deadline + grace period (288 blocks = 48 hours)
    simnet.mineEmptyBlocks(10 + 288 + 1);
    
    const balanceBefore = simnet.getAssetsMap().get("STX")?.get(address1) || 0n;
    
    // Creator reclaims expired stake
    const reclaimResult = simnet.callPublicFn("bitbond-escrow", "reclaim-expired-stake", [
      Cl.uint(1)
    ], address1);
    
    expect(reclaimResult.result).toBeOk(Cl.bool(true));
    
    const balanceAfter = simnet.getAssetsMap().get("STX")?.get(address1) || 0n;
    expect(balanceAfter).toEqual(balanceBefore + 1000000n);
    console.log("✅ Emergency reclaim successful - expired stake returned to creator");
  });

  it("cannot reclaim stake too early", () => {
    const currentHeight = simnet.blockHeight;
    
    const createResult = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Recent task"),
      Cl.stringAscii("Task created recently"),
      Cl.uint(1000000),
      Cl.uint(currentHeight + 100)
    ], address1);
    
    expect(createResult.result).toBeOk(Cl.uint(1));
    
    // Try to reclaim immediately (should fail)
    const reclaimResult = simnet.callPublicFn("bitbond-escrow", "reclaim-expired-stake", [
      Cl.uint(1)
    ], address1);
    
    expect(reclaimResult.result).toBeErr(Cl.uint(104)); // err-task-expired
    console.log("✅ Timing protection works - prevented early reclaim");
  });

  it("non-creator cannot reclaim stake", () => {
    const currentHeight = simnet.blockHeight;
    
    const createResult = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Protected task"),
      Cl.stringAscii("Task protected from unauthorized reclaim"),
      Cl.uint(1000000),
      Cl.uint(currentHeight + 10)
    ], address1);
    
    expect(createResult.result).toBeOk(Cl.uint(1));
    
    // Mine blocks to expire task
    simnet.mineEmptyBlocks(10 + 288 + 1);
    
    // Non-creator tries to reclaim
    const reclaimResult = simnet.callPublicFn("bitbond-escrow", "reclaim-expired-stake", [
      Cl.uint(1)
    ], address3);
    
    expect(reclaimResult.result).toBeErr(Cl.uint(102)); // err-unauthorized
    console.log("✅ Authorization protection - prevented unauthorized reclaim");
  });

  // ✅ Read-only function validation
  it("read-only functions return expected types", () => {
    // Test get-next-task-id
    const nextIdQuery = simnet.callReadOnlyFn("bitbond-escrow", "get-next-task-id", [], address1);
    expect(nextIdQuery.result).toStrictEqual(Cl.uint(1));
    console.log("✅ Next task ID function works");
    
    // Test get-contract-balance
    const balanceQuery = simnet.callReadOnlyFn("bitbond-escrow", "get-contract-balance", [], address1);
    expect(balanceQuery.result).toStrictEqual(Cl.uint(0));
    console.log("✅ Contract balance function works");
    
    // Test is-task-expired-check for non-existent task
    const expiredQuery = simnet.callReadOnlyFn("bitbond-escrow", "is-task-expired-check", [
      Cl.uint(999)
    ], address1);
    expect(expiredQuery.result).toStrictEqual(Cl.bool(false));
    console.log("✅ Task expiration check function works");
  });

  // ✅ Stress test with maximum values
  it("handles task creation with large values", () => {
    const maxStakeAmount = 1000000000000; // Large stake amount
    const farFutureDeadline = 999999; // Far future deadline
    
    const createResult = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Max stake task"),
      Cl.stringAscii("Task with maximum stake amount"),
      Cl.uint(maxStakeAmount),
      Cl.uint(farFutureDeadline)
    ], address1);
    
    expect(createResult.result).toBeOk(Cl.uint(1));
    console.log("✅ Large value handling works - no overflow issues");
  });

  // ✅ Multi-task scenario
  it("handles multiple tasks correctly", () => {
    // Create multiple tasks
    const create1 = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Task 1"),
      Cl.stringAscii("First task"),
      Cl.uint(500000),
      Cl.uint(1000)
    ], address1);
    
    const create2 = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address2),
      Cl.stringAscii("Task 2"),
      Cl.stringAscii("Second task"),
      Cl.uint(750000),
      Cl.uint(1000)
    ], address1);
    
    const create3 = simnet.callPublicFn("bitbond-escrow", "create-task", [
      Cl.principal(address3),
      Cl.stringAscii("Task 3"),
      Cl.stringAscii("Third task with different buddy"),
      Cl.uint(1200000),
      Cl.uint(1000)
    ], address1);
    
    expect(create1.result).toBeOk(Cl.uint(1));
    expect(create2.result).toBeOk(Cl.uint(2));
    expect(create3.result).toBeOk(Cl.uint(3));
    
    // Verify tasks with different outcomes
    const verify1 = simnet.callPublicFn("bitbond-escrow", "verify-task", [
      Cl.uint(1),
      Cl.bool(true) // Success
    ], address2);
    
    const verify2 = simnet.callPublicFn("bitbond-escrow", "verify-task", [
      Cl.uint(2),
      Cl.bool(false) // Failed
    ], address2);
    
    const verify3 = simnet.callPublicFn("bitbond-escrow", "verify-task", [
      Cl.uint(3),
      Cl.bool(true) // Success
    ], address3);
    
    expect(verify1.result).toBeOk(Cl.bool(true));
    expect(verify2.result).toBeOk(Cl.bool(false));
    expect(verify3.result).toBeOk(Cl.bool(true));
    
    console.log("✅ Multiple task scenario works - different buddies and outcomes");
  });
});
