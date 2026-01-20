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
import { Textarea } from "@/components/ui/textarea";
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
import { updateProfile, type ProfileFormData } from "@/app/actions/user";

// Form validation schema
const profileFormSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must be less than 50 characters"),
  email: z.string().email("Invalid email address"),
  bio: z.string().max(500, "Bio must be less than 500 characters"),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      bio: "",
    },
  });

  // Populate form with session data when available
  useEffect(() => {
    if (session?.user) {
      form.reset({
        displayName: session.user.name ?? "",
        email: session.user.email ?? "",
        bio: "",
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
        displayName: data.displayName,
        bio: data.bio ?? "",
      };

      const result = await updateProfile(formData);

      if (result.success) {
        toast.success(result.message);
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
                {/* Display Name Field */}
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your display name"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        This is your public display name. It can be your real
                        name or a pseudonym.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email Field (Read-only) */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled
                          className="bg-muted text-muted-foreground"
                        />
                      </FormControl>
                      <FormDescription>
                        Your email is managed by Keycloak and cannot be changed
                        here.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Bio Field */}
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us a little bit about yourself"
                          className="min-h-30 resize-none"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        A brief description about yourself. Max 500 characters.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              <strong>Note:</strong> Some profile fields like email and username
              are managed by your organization&apos;s identity provider
              (Keycloak). To change those fields, please contact your system
              administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
