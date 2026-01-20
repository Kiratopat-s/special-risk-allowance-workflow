import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  FileText,
  UserCheck,
  KeyRound,
  Monitor,
  Bell,
  AlertTriangle,
} from "lucide-react";

export default function TermsOfServicePage() {
  const lastUpdated = "January 20, 2026";

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <div className="space-y-8">
        {/* Back button */}
        <Button variant="ghost" asChild className="-ml-4">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Terms of Service
              </h1>
              <p className="text-sm text-muted-foreground">
                Special Risk Allowance Workflow System
              </p>
            </div>
          </div>
          <p className="text-muted-foreground">
            ข้อกำหนดและเงื่อนไขการใช้งานระบบจัดทำและติดตามเอกสารการเบิกค่าเงินเสี่ยงภัยพิเศษ
          </p>
          <p className="text-sm text-muted-foreground">
            Last Updated: {lastUpdated}
          </p>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>Terms and Conditions</CardTitle>
            <CardDescription>
              By accessing and using the Special Risk Allowance Workflow and
              Documentation System
              (ระบบจัดทำและติดตามเอกสารการเบิกค่าเงินเสี่ยงภัยพิเศษ), you agree
              to be bound by these Terms of Service.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto">
              <div className="space-y-8 pr-4">
                {/* Section 1: User Obligations */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">
                      1. User Obligations
                    </h2>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      As a user of this system, you agree to the following
                      obligations:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>
                        <strong>Authorization Requirement</strong> — You must be
                        an authorized employee of the organization to access and
                        use this system. Unauthorized access is strictly
                        prohibited and may result in disciplinary action.
                      </li>
                      <li>
                        <strong>Truthful Information</strong> — You must provide
                        accurate, complete, and truthful information when
                        submitting special risk allowance claims. This includes:
                        <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                          <li>
                            Accurate descriptions of risk-related activities
                          </li>
                          <li>Genuine supporting documentation and evidence</li>
                          <li>
                            Correct dates, amounts, and circumstances of claims
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>Account Security</strong> — You are responsible
                        for maintaining the confidentiality and security of your
                        account access. Do not share your login credentials with
                        others.
                      </li>
                      <li>
                        <strong>Compliance</strong> — You must comply with all
                        applicable organizational policies and regulations
                        regarding special risk allowances.
                      </li>
                    </ul>
                    <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg mt-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                          <p className="font-medium text-destructive">
                            Important Notice
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Submission of false or fraudulent claims is a
                            serious violation and may result in disciplinary
                            action, including termination of employment and
                            potential legal consequences.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 2: Account Access */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">2. Account Access</h2>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Access to the Special Risk Allowance Workflow System is
                      governed by the following rules:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>
                        <strong>Corporate Google Account Required</strong> —
                        System access is granted exclusively through corporate
                        Google Accounts provided by the organization. Personal
                        email accounts are not permitted.
                      </li>
                      <li>
                        <strong>Single Sign-On (SSO)</strong> — Authentication
                        is handled through Google OAuth integration, providing
                        secure and streamlined access.
                      </li>
                      <li>
                        <strong>Role Assignment</strong> — Your access level and
                        permissions are determined by your organizational role
                        and assigned by system administrators.
                      </li>
                      <li>
                        <strong>Access Revocation</strong> — Access may be
                        revoked at any time by system administrators,
                        particularly upon termination of employment or change in
                        role responsibilities.
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 3: System Usage */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">3. System Usage</h2>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      The system is designed for specific business purposes and
                      must be used accordingly:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>
                        <strong>Internal Business Use Only</strong> — This
                        system is intended exclusively for internal
                        organizational use to manage special risk allowance
                        document workflows and approvals.
                      </li>
                      <li>
                        <strong>Document Management</strong> — The system
                        facilitates:
                        <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                          <li>Submission of special risk allowance requests</li>
                          <li>Document attachment and evidence upload</li>
                          <li>Multi-level approval workflow processing</li>
                          <li>Status tracking and historical record keeping</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Prohibited Activities</strong> — Users shall
                        not:
                        <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                          <li>
                            Attempt to bypass security controls or access
                            restrictions
                          </li>
                          <li>
                            Use the system for personal or non-business purposes
                          </li>
                          <li>Share system data with unauthorized parties</li>
                          <li>
                            Interfere with system operations or other
                            users&apos; access
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 4: Notifications */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">
                      4. Notifications and Communications
                    </h2>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      By using this system, you agree to receive notifications
                      and communications regarding your document submissions and
                      system activities:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>
                        <strong>Status Updates</strong> — You will receive
                        notifications about changes to your submitted documents,
                        including approval, rejection, or requests for
                        additional information.
                      </li>
                      <li>
                        <strong>Communication Channels</strong> — Notifications
                        may be sent through configured channels including:
                        <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                          <li>
                            Email notifications to your corporate email address
                          </li>
                          <li>LINE messaging (if configured)</li>
                          <li>In-app notifications within the system</li>
                        </ul>
                      </li>
                      <li>
                        <strong>System Announcements</strong> — You may receive
                        important system announcements regarding maintenance,
                        updates, or policy changes.
                      </li>
                      <li>
                        <strong>Notification Preferences</strong> — Where
                        available, you may configure your notification
                        preferences through your profile settings.
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 5: Limitation of Liability */}
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold">
                    5. Limitation of Liability
                  </h2>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      The organization provides this system &quot;as is&quot;
                      and makes no warranties regarding continuous availability
                      or error-free operation. The organization shall not be
                      liable for:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>System downtime or service interruptions</li>
                      <li>
                        Data loss resulting from technical failures (users are
                        advised to keep personal records)
                      </li>
                      <li>
                        Delays in document processing due to technical issues
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 6: Changes to Terms */}
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold">6. Changes to Terms</h2>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      The organization reserves the right to modify these Terms
                      of Service at any time. Users will be notified of
                      significant changes through system announcements.
                      Continued use of the system after changes constitutes
                      acceptance of the modified terms.
                    </p>
                  </div>
                </section>

                {/* Section 7: Contact */}
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold">
                    7. Contact Information
                  </h2>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      For questions or concerns regarding these Terms of
                      Service, please contact the system administrator or your
                      department&apos;s administrative officer.
                    </p>
                  </div>
                </section>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Bottom Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/privacy">View Privacy Policy</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
