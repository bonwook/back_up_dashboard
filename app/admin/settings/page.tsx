import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure system settings and AWS integration</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AWS S3 Configuration</CardTitle>
            <CardDescription>Configure AWS S3 bucket for DICOM storage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bucket">S3 Bucket Name</Label>
              <Input id="bucket" placeholder="flonics-dicom-data" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">AWS Region</Label>
              <Input id="region" placeholder="us-east-1" />
            </div>
            <Button>Save AWS Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Configuration</CardTitle>
            <CardDescription>Configure email settings for DICOM delivery</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Receiving Email</Label>
              <Input id="email" type="email" placeholder="dicom@flonics.com" />
            </div>
            <Button>Save Email Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Current system status and configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database Status:</span>
                <span className="font-medium text-green-500">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AWS S3 Status:</span>
                <span className="font-medium text-green-500">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">System Version:</span>
                <span className="font-medium">1.0.0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
