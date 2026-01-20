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
import { ArrowLeft, Shield, Database, Lock, Eye } from "lucide-react";

export default function PrivacyPolicyPage() {
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
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-sm text-muted-foreground">
                Special Risk Allowance Workflow System
              </p>
            </div>
          </div>
          <p className="text-muted-foreground">
            นโยบายความเป็นส่วนตัวสำหรับระบบจัดทำและติดตามเอกสารการเบิกค่าเงินเสี่ยงภัยพิเศษ
          </p>
          <p className="text-sm text-muted-foreground">
            Last Updated: {lastUpdated}
          </p>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle>About This Policy</CardTitle>
            <CardDescription>
              This Privacy Policy describes how the Special Risk Allowance
              Workflow and Documentation System
              (ระบบจัดทำและติดตามเอกสารการเบิกค่าเงินเสี่ยงภัยพิเศษ) collects,
              uses, and protects your personal information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto">
              <div className="space-y-8 pr-4">
                {/* Section 1: Data Collection */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">
                      1. Data Collection
                    </h2>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      We collect personal information through{" "}
                      <strong>Google OAuth authentication</strong> to verify
                      your identity and provide access to the system. The
                      information collected includes:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>
                        <strong>Full Name</strong> — Used for identification and
                        document attribution
                      </li>
                      <li>
                        <strong>Email Address</strong> — Used for account
                        identification and system notifications
                      </li>
                      <li>
                        <strong>Profile Picture</strong> — Used for visual
                        identification within the system interface
                      </li>
                    </ul>
                    <p>
                      Additionally, the system collects data related to your
                      special risk allowance requests, including:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Request submission details and timestamps</li>
                      <li>Document attachments and supporting evidence</li>
                      <li>Approval workflow history and status changes</li>
                      <li>Risk assessment information as provided by you</li>
                    </ul>
                  </div>
                </section>

                {/* Section 2: Data Usage */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">
                      2. How We Use Your Data
                    </h2>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Your personal information is used exclusively for the
                      following purposes:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>
                        <strong>
                          Processing Special Risk Allowance Requests
                        </strong>{" "}
                        — To facilitate the submission, review, and approval of
                        your risk allowance claims
                      </li>
                      <li>
                        <strong>Document Status Tracking</strong> — To provide
                        real-time updates on the status of your submitted
                        documents throughout the approval workflow
                      </li>
                      <li>
                        <strong>Expense Report Generation</strong> — To compile
                        departmental expense reports and financial summaries for
                        authorized personnel
                      </li>
                      <li>
                        <strong>Audit and Compliance</strong> — To maintain
                        accurate records for internal auditing and regulatory
                        compliance purposes
                      </li>
                      <li>
                        <strong>System Notifications</strong> — To send you
                        updates regarding your document status via email or
                        other configured notification channels
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 3: Data Retention */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">3. Data Retention</h2>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      To ensure transparency and maintain comprehensive audit
                      trails, our system implements a{" "}
                      <strong>Soft Delete</strong> policy for data management:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>
                        When you request deletion of your data, records are
                        marked as deleted but retained in our system for audit
                        and historical verification purposes
                      </li>
                      <li>
                        Soft-deleted data is not visible in regular system
                        operations but remains accessible for authorized audit
                        reviews
                      </li>
                      <li>
                        This approach ensures compliance with financial
                        record-keeping requirements and supports organizational
                        transparency
                      </li>
                      <li>
                        Complete data purge requests may be submitted to the
                        system administrator for review on a case-by-case basis,
                        subject to regulatory requirements
                      </li>
                    </ul>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      <strong>Note:</strong> Data retention periods comply with
                      applicable Thai financial record-keeping regulations and
                      organizational policies.
                    </p>
                  </div>
                </section>

                {/* Section 4: Data Security */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">4. Data Security</h2>
                  </div>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      We implement robust security measures to protect your
                      personal information:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>
                        <strong>Role-Based Access Control (RBAC)</strong> — Data
                        visibility is strictly controlled based on user roles:
                        <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                          <li>
                            <strong>Employees</strong> — Can view and manage
                            only their own requests
                          </li>
                          <li>
                            <strong>Supervisors</strong> — Can access requests
                            from their team members for approval
                          </li>
                          <li>
                            <strong>Administrators</strong> — Have system-wide
                            access for management and reporting
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>Secure Authentication</strong> — All access is
                        authenticated through corporate Google OAuth, ensuring
                        verified identities
                      </li>
                      <li>
                        <strong>Encrypted Transmission</strong> — All data
                        transfers are encrypted using industry-standard HTTPS
                        protocols
                      </li>
                      <li>
                        <strong>Activity Logging</strong> — All system
                        activities are logged for security monitoring and audit
                        purposes
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 5: Contact */}
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold">5. Contact Us</h2>
                  <Separator />
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      If you have any questions or concerns about this Privacy
                      Policy or your personal data, please contact the system
                      administrator or your department&apos;s data protection
                      officer.
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
            <Link href="/terms">View Terms of Service</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
