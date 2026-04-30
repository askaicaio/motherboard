"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  onboardingRequestSchema,
  type OnboardingRequestInput,
} from "@/lib/utils/validation";
import { DEPARTMENTS, DIVISIONS, type ToolKey } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToolSelector } from "./tool-selector";

export function OnboardingRequestForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<OnboardingRequestInput>({
    resolver: zodResolver(onboardingRequestSchema) as any,
    defaultValues: {
      employeeName: "",
      preferredName: "",
      employeeEmail: "",
      personalEmail: "",
      phone: "",
      jobTitle: "",
      department: undefined,
      division: undefined,
      managerName: "",
      managerEmail: "",
      startDate: "",
      timezone: "",
      employmentType: undefined,
      location: "",
      onboardingOwner: "",
      workEmailPrefix: "",
      notes: "",
      requestedTools: [],
      slackChannels: [],
      googleGroups: [],
      clickupAccessType: "",
      onepasswordVaultProfile: "",
      manualOverrideNotes: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const selectedTools = watch("requestedTools") as ToolKey[];

  async function onSubmit(data: OnboardingRequestInput) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          idempotencyKey: `onb_${nanoid(16)}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create request");
      }

      const result = await response.json();
      toast.success("Onboarding request created successfully");
      router.push(`/onboarding/${result.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create request"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Employee Information */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
          <CardDescription>
            Basic details about the new team member.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="employeeName">Full Name *</Label>
            <Input id="employeeName" {...register("employeeName")} />
            {errors.employeeName && (
              <p className="text-xs text-red-500">{errors.employeeName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredName">Preferred Name</Label>
            <Input id="preferredName" {...register("preferredName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employeeEmail">Work Email *</Label>
            <Input id="employeeEmail" type="email" {...register("employeeEmail")} />
            {errors.employeeEmail && (
              <p className="text-xs text-red-500">{errors.employeeEmail.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="personalEmail">Personal Email</Label>
            <Input id="personalEmail" type="email" {...register("personalEmail")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workEmailPrefix">Work Email Prefix / Alias</Label>
            <Input id="workEmailPrefix" {...register("workEmailPrefix")} placeholder="e.g., jdoe" />
          </div>
        </CardContent>
      </Card>

      {/* Role & Department */}
      <Card>
        <CardHeader>
          <CardTitle>Role & Department</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title *</Label>
            <Input id="jobTitle" {...register("jobTitle")} />
            {errors.jobTitle && (
              <p className="text-xs text-red-500">{errors.jobTitle.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Department *</Label>
            <Select onValueChange={(v) => setValue("department", v as (typeof DEPARTMENTS)[number])}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.department && (
              <p className="text-xs text-red-500">{errors.department.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Division *</Label>
            <Select onValueChange={(v) => setValue("division", v as "b2c" | "b2b" | "sales")}>
              <SelectTrigger>
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {DIVISIONS.map((div) => (
                  <SelectItem key={div.value} value={div.value}>
                    {div.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.division && (
              <p className="text-xs text-red-500">{errors.division.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Employment Type</Label>
            <Select onValueChange={(v) => setValue("employmentType", v as "full_time" | "part_time" | "contractor")}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input id="startDate" type="date" {...register("startDate")} />
            {errors.startDate && (
              <p className="text-xs text-red-500">{errors.startDate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" {...register("timezone")} placeholder="e.g., America/New_York" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...register("location")} placeholder="Remote / Office name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboardingOwner">Onboarding Owner</Label>
            <Input id="onboardingOwner" {...register("onboardingOwner")} placeholder="Who's responsible" />
          </div>
        </CardContent>
      </Card>

      {/* Manager */}
      <Card>
        <CardHeader>
          <CardTitle>Manager</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="managerName">Manager Name</Label>
            <Input id="managerName" {...register("managerName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managerEmail">Manager Email</Label>
            <Input id="managerEmail" type="email" {...register("managerEmail")} />
          </div>
        </CardContent>
      </Card>

      {/* Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Tools & Access *</CardTitle>
          <CardDescription>
            Select the tools this employee needs access to. Rules-based defaults
            will be applied on approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToolSelector
            selected={selectedTools}
            onChange={(tools) => setValue("requestedTools", tools)}
          />
          {errors.requestedTools && (
            <p className="mt-2 text-xs text-red-500">
              {errors.requestedTools.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Advanced Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Overrides</CardTitle>
          <CardDescription>
            Optional. Override defaults from provisioning rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clickupAccessType">ClickUp Access Type</Label>
            <Input
              id="clickupAccessType"
              {...register("clickupAccessType")}
              placeholder="member / admin / guest"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onepasswordVaultProfile">1Password Vault Profile</Label>
            <Input
              id="onepasswordVaultProfile"
              {...register("onepasswordVaultProfile")}
              placeholder="e.g., Moderators"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="manualOverrideNotes">Manual Override Notes</Label>
            <Textarea
              id="manualOverrideNotes"
              {...register("manualOverrideNotes")}
              placeholder="Any special instructions that override standard rules..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("notes")}
            placeholder="Additional notes or special instructions..."
            rows={4}
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Onboarding Request"}
        </Button>
      </div>
    </form>
  );
}
