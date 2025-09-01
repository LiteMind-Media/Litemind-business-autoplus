"use client";
import React from "react";
import { Customer } from "@/types/customer";

const steps = [
    "Form Registered",
    "First Contact",
    "First Call Status",
    "Second Contact",
    "Final Status"
];

function getProgressStep(customer: Customer): number {
    // Step 1: Registered on form (baseline)
    // Step 2: First contact made (firstCallDate present)
    // Step 3: First call status set (firstCallStatus not empty)
    // Step 4: Second contact (They Called/We Called OR secondCallDate present)
    // Step 5: Registered (finalStatus === 'Registered')
    let step = 1;
    if (customer.firstCallDate?.trim()) step = 2;
    if (customer.firstCallStatus?.trim()) step = 3;
    if (
        customer.secondCallDate?.trim() ||
        customer.secondCallStatus === 'They Called' ||
        customer.secondCallStatus === 'We Called'
    ) {
        step = 4;
    }
    if (customer.finalStatus === 'Registered') step = 5;
    return step;
}

export default function CustomerProgressBar({ customer }: { customer: Customer }) {
    const currentStep = getProgressStep(customer);
    return (
        <div className="w-full">
            <div className="mx-auto max-w-[320px]">
                <div className="flex items-center w-full">
                    {steps.map((label, idx) => {
                        const isComplete = idx < currentStep;
                        const isCurrent = idx === currentStep - 1;
                        return (
                            <React.Fragment key={label}>
                                <div
                                    className={`w-5 h-5 rounded-full border-2 shadow-sm ${isComplete ? "bg-blue-600 border-blue-600" : isCurrent ? "bg-white border-blue-600" : "bg-gray-200 border-gray-300"
                                        }`}
                                    title={`${label}${isCurrent ? " (current)" : isComplete ? " (done)" : ""}`}
                                />
                                {idx < steps.length - 1 && (
                                    <div className={`flex-1 h-1 ${isComplete ? "bg-blue-600" : "bg-gray-200"}`}></div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
            <div className="mt-1 text-[11px] text-gray-600 text-center">Step {currentStep} of {steps.length}</div>
        </div>
    );
}
