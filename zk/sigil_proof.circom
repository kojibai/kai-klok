pragma circom 2.0.0;

// ✅ Update the path below if needed (depending on your folder structure)
include "poseidon.circom";

template SigilProof() {
    // ────────────────────────────────────────────────
    // PRIVATE INPUT: The user's harmonic secret (e.g. biometric-derived)
    // This is never revealed; it’s used to prove knowledge of the input
    // that produced the KaiSignature.
    // ────────────────────────────────────────────────
    signal input secret;

    // PUBLIC INPUT: The expected KaiSignature (Poseidon hash)
    // This value is public and embedded in the sigil file or transfer manifest.
    signal input expectedHash;

    // ────────────────────────────────────────────────
    // Poseidon(1) → 1 input → returns 1 output hash
    // ────────────────────────────────────────────────
    component poseidon = Poseidon(1);
    poseidon.inputs[0] <== secret;

    // Enforce: expectedHash == Poseidon(secret)
    expectedHash === poseidon.out;
}

// Compile entry point
component main = SigilProof();
