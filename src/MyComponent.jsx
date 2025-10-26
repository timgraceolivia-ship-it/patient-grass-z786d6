import React, { useState } from "react";

export default function OARDoseCalculator() {
  const [alphaBeta, setAlphaBeta] = useState(3); // Gy
  const [toleranceMode, setToleranceMode] = useState("EQD2"); // "EQD2" or "BED"
  const [toleranceEQD2, setToleranceEQD2] = useState("");
  const [toleranceBED, setToleranceBED] = useState("");
  const [discountMode, setDiscountMode] = useState("none");
  const [plannedFractions, setPlannedFractions] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(false); // 👈 NEW STATE

  // Previous courses
  const [courses, setCourses] = useState([
    { totalDose: "", fractions: "", eqd2: "", useDirect: false },
    { totalDose: "", fractions: "", eqd2: "", useDirect: false },
    { totalDose: "", fractions: "", eqd2: "", useDirect: false },
  ]);

  // ✅ Reset all fields
  function handleReset() {
    setAlphaBeta(3);
    setToleranceMode("EQD2");
    setToleranceEQD2("");
    setToleranceBED("");
    setDiscountMode("none");
    setPlannedFractions("");
    setCourses([
      { totalDose: "", fractions: "", eqd2: "", useDirect: false },
      { totalDose: "", fractions: "", eqd2: "", useDirect: false },
      { totalDose: "", fractions: "", eqd2: "", useDirect: false },
    ]);
  }

  // --- Radiobiological equations ---
  function computeBED(n, d, aOverB) {
    const N = Number(n);
    const D = Number(d);
    const aB = Number(aOverB);
    if (!N || !D || !aB) return NaN;
    return N * D * (1 + D / aB);
  }

  function bedToEQD2(bed, aOverB) {
    const aB = Number(aOverB);
    if (!bed || !aB) return NaN;
    return bed / (1 + 2 / aB);
  }

  function eqd2ToBED(eqd2, aOverB) {
    const aB = Number(aOverB);
    if (!eqd2 || !aB) return NaN;
    return eqd2 * (1 + 2 / aB);
  }

  function eqd2FromPhysical(n, d, aOverB) {
    const bed = computeBED(n, d, aOverB);
    return bedToEQD2(bed, aOverB);
  }

  function physicalDosePerFractionFromEQD2(eqd2, n, aOverB) {
    const E = Number(eqd2);
    const N = Number(n);
    const aB = Number(aOverB);
    if (!E || !N || !aB) return NaN;
    const c = (E / N) * (1 + 2 / aB);
    const A = 1 / aB;
    const B = 1;
    const C = -c;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return NaN;
    const d = (-B + Math.sqrt(disc)) / (2 * A);
    return d;
  }

  const discountFactor =
    discountMode === "50%" ? 0.5 : discountMode === "25%" ? 0.75 : 1.0;

  // --- Compute combined previous EQD2 from up to 3 courses ---
  const prevEQD2Total = courses.reduce((sum, c) => {
    let val = 0;
    if (c.useDirect) {
      val = Number(c.eqd2 || 0);
    } else if (c.totalDose && c.fractions) {
      const n = Number(c.fractions);
      const D = Number(c.totalDose);
      if (n && D) val = eqd2FromPhysical(n, D / n, alphaBeta);
    }
    return sum + val;
  }, 0);

  const prevEQD2Discounted = prevEQD2Total * discountFactor;

  // --- Handle tolerance mode (EQD2 or BED) ---
  let tolEQD2 = 0;
  let tolBED = 0;

  if (toleranceMode === "EQD2") {
    tolEQD2 = Number(toleranceEQD2 || 0);
    tolBED = eqd2ToBED(tolEQD2, alphaBeta);
  } else {
    tolBED = Number(toleranceBED || 0);
    tolEQD2 = bedToEQD2(tolBED, alphaBeta);
  }

  const remainingEQD2 = Math.max(0, tolEQD2 - prevEQD2Discounted);
  const remainingBED = eqd2ToBED(remainingEQD2, alphaBeta);

  const dosePerFraction = physicalDosePerFractionFromEQD2(
    remainingEQD2,
    plannedFractions,
    alphaBeta
  );
  const totalPhysicalDose = dosePerFraction * plannedFractions;

  const exceeded = prevEQD2Discounted > tolEQD2;

  function updateCourse(index, field, value) {
    const updated = [...courses];
    updated[index][field] = value;
    setCourses(updated);
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow relative">
      <h1 className="text-2xl font-semibold mb-3">
        Tim Wang&apos;s Organ-at-Risk (OAR) Dose Limit Calculator
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Supports up to three previous radiotherapy courses with optional dose
        discount and tolerance entry in EQD₂ or BED.
      </p>

      <label className="flex flex-col mb-4">
        <span className="font-medium">Tissue α/β (Gy)</span>
        <input
          type="number"
          step="0.1"
          value={alphaBeta}
          onChange={(e) => setAlphaBeta(e.target.value)}
          className="mt-1 p-2 border rounded"
        />
      </label>

      {/* --- Previous courses --- */}
      {courses.map((c, i) => {
        let computedEQD2 = NaN;
        let computedBED = NaN;

        if (!c.useDirect && c.totalDose && c.fractions) {
          const n = Number(c.fractions);
          const D = Number(c.totalDose);
          if (n && D) {
            const d = D / n;
            computedBED = computeBED(n, d, alphaBeta);
            computedEQD2 = bedToEQD2(computedBED, alphaBeta);
          }
        } else if (c.useDirect && c.eqd2) {
          computedEQD2 = Number(c.eqd2);
          computedBED = eqd2ToBED(computedEQD2, alphaBeta);
        }

        return (
          <div key={i} className="border p-3 rounded mb-3">
            <h3 className="font-medium mb-2">Previous Course {i + 1}</h3>
            <label className="flex items-center space-x-2 mb-2">
              <input
                type="checkbox"
                checked={c.useDirect}
                onChange={(e) => updateCourse(i, "useDirect", e.target.checked)}
              />
              <span>Provide EQD₂ directly</span>
            </label>

            {!c.useDirect ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex flex-col">
                  <span className="text-sm">Total dose (Gy)</span>
                  <input
                    type="number"
                    value={c.totalDose}
                    onChange={(e) =>
                      updateCourse(i, "totalDose", e.target.value)
                    }
                    className="p-2 border rounded"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm">Fractions</span>
                  <input
                    type="number"
                    value={c.fractions}
                    onChange={(e) =>
                      updateCourse(i, "fractions", e.target.value)
                    }
                    className="p-2 border rounded"
                  />
                </label>
              </div>
            ) : (
              <label className="flex flex-col">
                <span className="text-sm">EQD₂ (Gy)</span>
                <input
                  type="number"
                  value={c.eqd2}
                  onChange={(e) => updateCourse(i, "eqd2", e.target.value)}
                  className="p-2 border rounded"
                />
              </label>
            )}

            {/* --- Computed BED & EQD2 display --- */}
            {!isNaN(computedBED) && isFinite(computedBED) && (
              <div className="mt-2 text-sm text-gray-700">
                Computed BED:{" "}
                <span className="font-medium">{computedBED.toFixed(2)} Gy</span>
              </div>
            )}

            {!isNaN(computedEQD2) && isFinite(computedEQD2) && !c.useDirect && (
              <div className="text-sm text-gray-700">
                Computed EQD₂:{" "}
                <span className="font-medium">
                  {computedEQD2.toFixed(2)} Gy
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* --- Organ tolerance section --- */}
      <div className="mt-6 border-t pt-4">
        <h3 className="font-medium mb-2">Organ tolerance / reserve</h3>

        <div className="flex items-center gap-4 mb-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={toleranceMode === "EQD2"}
              onChange={() => setToleranceMode("EQD2")}
            />
            <span>Enter EQD₂ (Gy₂)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={toleranceMode === "BED"}
              onChange={() => setToleranceMode("BED")}
            />
            <span>Enter BED (Gy)</span>
          </label>
        </div>

        {toleranceMode === "EQD2" ? (
          <input
            type="number"
            step="0.1"
            value={toleranceEQD2}
            onChange={(e) => setToleranceEQD2(e.target.value)}
            className="p-2 border rounded w-40"
            placeholder="EQD₂ in Gy₂"
          />
        ) : (
          <input
            type="number"
            step="0.1"
            value={toleranceBED}
            onChange={(e) => setToleranceBED(e.target.value)}
            className="p-2 border rounded w-40"
            placeholder="BED in Gy"
          />
        )}

        {(toleranceEQD2 || toleranceBED) && (
          <div className="mt-2 text-sm text-gray-700">
            Equivalent values:{" "}
            <span className="font-medium">
              {tolEQD2.toFixed(2)} Gy₂ (EQD₂), {tolBED.toFixed(2)} Gy (BED)
            </span>
          </div>
        )}
      </div>

      {/* --- Previous dose discount --- */}
      <div className="mt-6 flex flex-col gap-2 mb-4">
        <h3 className="font-medium mb-2">Previous dose discount</h3>
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="discount"
            checked={discountMode === "none"}
            onChange={() => setDiscountMode("none")}
          />
          <span>No discount</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="discount"
            checked={discountMode === "25%"}
            onChange={() => setDiscountMode("25%")}
          />
          <span>25% discount</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            name="discount"
            checked={discountMode === "50%"}
            onChange={() => setDiscountMode("50%")}
          />
          <span>50% discount</span>
        </label>
      </div>

      {/* --- Planned fractions --- */}
      <div className="mt-6 mb-6">
        <h3 className="font-medium mb-2">Planned number of fractions</h3>
        <input
          type="number"
          step="1"
          value={plannedFractions}
          onChange={(e) => setPlannedFractions(e.target.value)}
          className="p-2 border rounded w-32"
        />
      </div>

      {/* --- Reset Button --- */}
      <div className="mt-4 mb-6 text-center">
        <button
          onClick={handleReset}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow transition"
        >
          Reset All
        </button>
      </div>

      <hr className="my-6" />

      {/* --- Results summary --- */}
      <div className="space-y-3">
        <div className="p-4 border rounded">
          <div className="text-xs text-gray-500">
            Total previous EQD₂ (discounted)
          </div>
          <div className="text-lg font-medium">
            {isNaN(prevEQD2Discounted) ? "—" : prevEQD2Discounted.toFixed(2)} Gy
          </div>
        </div>

        <div className={`p-4 border rounded ${exceeded ? "bg-red-50" : ""}`}>
          <div className="text-xs text-gray-500">Organ tolerance</div>
          <div className="text-lg font-medium">
            {tolEQD2.toFixed(2)} Gy₂ (EQD₂) / {tolBED.toFixed(2)} Gy (BED)
          </div>
          <div className="text-sm text-gray-600">
            Remaining EQD₂: {remainingEQD2.toFixed(2)} Gy₂ → Remaining BED:{" "}
            {remainingBED.toFixed(2)} Gy {exceeded ? "(EXCEEDED)" : ""}
          </div>
        </div>

        <div className="p-4 border rounded">
          <div className="text-xs text-gray-500">
            Example future regimen ({plannedFractions} fractions)
          </div>
          {isNaN(dosePerFraction) || !isFinite(dosePerFraction) ? (
            <div className="text-sm text-gray-600">
              Insufficient data or no remaining dose.
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-600">
                Dose per fraction ≈ {dosePerFraction.toFixed(2)} Gy
              </div>
              <div className="text-lg font-bold">
                Total physical dose ≈ {totalPhysicalDose.toFixed(2)} Gy
              </div>
            </>
          )}
        </div>
      </div>

      {/* --- Disclaimer Button --- */}
      <div className="text-center mt-8">
        <button
          onClick={() => setShowDisclaimer(true)}
          className="text-blue-600 underline hover:text-blue-800 text-sm"
        >
          View Disclaimer
        </button>
      </div>

      {/* --- Disclaimer Modal --- */}
      {showDisclaimer && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white max-w-lg p-6 rounded-xl shadow-lg">
            <h2 className="text-lg font-semibold mb-2">Disclaimer</h2>
            <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">
              The owner of this website does not guarantee that the information
              provided is free from errors or omissions. The Biologically
              Effective Dose (BED) and Equivalent Dose in 2 Gy fractions (EQD2)
              calculators are based on the Linear Quadratic (LQ) Model. As with
              any model, there are inherent limitations, including the omission
              of time-dependent factors and reduced applicability at very low or
              very high doses per fraction.
              {"\n\n"}
              All clinical decisions based on these results remain the sole
              responsibility of the treating clinician.
            </p>
            <div className="text-right">
              <button
                onClick={() => setShowDisclaimer(false)}
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
