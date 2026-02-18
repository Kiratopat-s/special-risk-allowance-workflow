"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/user-avatar";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import {
  updateKeycloakProfile,
  type ProfileFormData,
} from "@/app/actions/user";

// Form validation schema
const profileFormSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must be less than 50 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .max(100, "Email must be less than 100 characters"),
  peaEmail: z
    .string()
    .email("Invalid PEA email address")
    .max(100, "PEA Email must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  employeeId: z
    .string()
    .max(50, "Employee ID must be less than 50 characters")
    .optional()
    .or(z.literal("")),
  phoneNumber: z
    .string()
    .max(20, "Phone number must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  position: z
    .string()
    .max(100, "Position must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  positionShort: z
    .string()
    .max(20, "Position short must be less than 20 characters")
    .optional()
    .or(z.literal("")),
  positionLevel: z
    .string()
    .max(50, "Position level must be less than 50 characters")
    .optional()
    .or(z.literal("")),
  department: z
    .string()
    .max(100, "Department must be less than 100 characters")
    .optional()
    .or(z.literal("")),
  departmentShort: z
    .string()
    .max(20, "Department short must be less than 20 characters")
    .optional()
    .or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      peaEmail: "",
      employeeId: "",
      phoneNumber: "",
      position: "",
      positionShort: "",
      positionLevel: "",
      department: "",
      departmentShort: "",
    },
  });

  // Populate form with session data when available
  useEffect(() => {
    if (session?.user) {
      form.reset({
        firstName: session.user.firstName ?? "",
        lastName: session.user.lastName ?? "",
        email: session.user.email ?? "",
        peaEmail: session.user.peaEmail ?? "",
        employeeId: session.user.employeeId ?? "",
        phoneNumber: session.user.phoneNumber ?? "",
        position: session.user.position ?? "",
        positionShort: session.user.positionShort ?? "",
        positionLevel: session.user.positionLevel ?? "",
        department: session.user.department ?? "",
        departmentShort: session.user.departmentShort ?? "",
      });
    }
  }, [session, form]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin");
    }
  }, [status, router]);

  const onSubmit = (data: ProfileFormValues) => {
    startTransition(async () => {
      const formData: ProfileFormData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        peaEmail: data.peaEmail ?? "",
        employeeId: data.employeeId ?? "",
        phoneNumber: data.phoneNumber ?? "",
        position: data.position ?? "",
        positionShort: data.positionShort ?? "",
        positionLevel: data.positionLevel ?? "",
        department: data.department ?? "",
        departmentShort: data.departmentShort ?? "",
      };

      const result = await updateKeycloakProfile(formData);

      if (result.success) {
        toast.success(result.message);
        // Trigger session update with new user data
        if (result.updatedUser) {
          await updateSession({ user: result.updatedUser });
        }
        router.push("/profile");
      } else {
        toast.error(result.message);

        // Set field errors if any
        if (result.errors) {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (messages && messages.length > 0) {
              form.setError(field as keyof ProfileFormValues, {
                message: messages[0],
              });
            }
          });
        }
      }
    });
  };

  // Loading state
  if (status === "loading") {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Back button */}
        <Button variant="ghost" asChild className="-ml-4">
          <Link href="/profile">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Link>
        </Button>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Edit Profile</h1>
          <p className="text-muted-foreground">
            Update your profile information
          </p>
        </div>

        {/* Edit Form Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <UserAvatar
                name={session.user.name}
                image={session.user.image}
                size="lg"
              />
              <div>
                <CardTitle>{session.user.name ?? "User"}</CardTitle>
                <CardDescription>{session.user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Separator className="mb-6" />

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* Personal Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Personal Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* First Name Field */}
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your first name"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Last Name Field */}
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your last name"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email Field */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your email address"
                            {...field}
                            // disabled={isPending}
                            disabled
                            className="bg-muted text-muted-foreground"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* PEA Email Field */}
                  <FormField
                    control={form.control}
                    name="peaEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PEA Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your PEA email address"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Employee ID Field */}
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your employee ID"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone Number Field */}
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your phone number"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Work Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Work Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Position Field */}
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your position"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Position Short Field */}
                    <FormField
                      control={form.control}
                      name="positionShort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position (Short)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., PM, Dev"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Position Level Field */}
                  <FormField
                    control={form.control}
                    name="positionLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position Level</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your position level"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Department Field */}
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your department"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Department Short Field */}
                    <FormField
                      control={form.control}
                      name="departmentShort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department (Short)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., IT, HR"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Form Actions */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/profile")}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-muted bg-muted/30">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Your email address is managed by your
              organization&apos;s identity provider (Keycloak). To change your
              email, please contact your system administrator. Other profile
              fields will be updated directly in Keycloak.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
