import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link to="/register">
            <Button variant="outline">← Back to Registration</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms and Conditions</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
              Note: This is placeholder text. Real legal text to be written.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">Terms of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                By using Vector, you agree to track your energy levels and provide
                information about your daily activities, lifestyle, and well-being.
                This service is designed to help you understand your energy patterns
                and receive personalized recommendations.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Your privacy is important to us. Here's what you need to know about
                how we handle your data:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>All data is stored locally on your device using IndexedDB</li>
                <li>No data is sent to external servers without your explicit consent</li>
                <li>You maintain full ownership of your energy tracking data</li>
                <li>You can export or delete your data at any time</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Data Collection</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                We collect the following information to provide you with personalized
                energy tracking and recommendations:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Energy logs: Physical, mental, and emotional energy levels</li>
                <li>Lifestyle profile: Sleep patterns, exercise, nutrition habits</li>
                <li>Daily activities: Work, rest, and recovery patterns</li>
                <li>Goals and preferences: Your personal energy targets</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                All this information is used solely to help you track and improve
                your energy levels. When AI features are enabled, this data may be
                processed to provide personalized predictions and recommendations.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                You have the following rights regarding your data:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  <strong>Right to access:</strong> You can view all your stored
                  data at any time through the app interface
                </li>
                <li>
                  <strong>Right to export:</strong> You can export your data in
                  machine-readable format
                </li>
                <li>
                  <strong>Right to delete:</strong> You can permanently delete your
                  account and all associated data
                </li>
                <li>
                  <strong>Right to withdraw consent:</strong> You can stop using the
                  service at any time
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">AI Features</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vector includes optional AI-powered features that analyze your energy
                patterns and provide predictions. When you use these features, your
                anonymized data may be processed by external AI services (such as Groq).
                No personally identifiable information is included in these requests.
                You can disable AI features at any time in your settings.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update these terms from time to time. You will be notified of
                any significant changes through the app. Continued use of Vector after
                such changes constitutes acceptance of the new terms.
              </p>
            </section>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                By clicking "Register" on the registration page, you confirm that you
                have read, understood, and agree to these Terms and Conditions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
