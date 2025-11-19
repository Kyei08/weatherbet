import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const WebhookTester = () => {
  const { toast } = useToast();
  const [payload, setPayload] = useState('{\n  "type": "payment.succeeded",\n  "id": "evt_test123",\n  "payload": {\n    "id": "ch_test123",\n    "amount": 10000,\n    "metadata": {\n      "supabase_user_id": "user-id-here"\n    }\n  }\n}');
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; message: string } | null>(null);

  const handleTest = async () => {
    try {
      setLoading(true);
      setResult(null);

      // Validate JSON
      try {
        JSON.parse(payload);
      } catch (e) {
        toast({
          title: 'Invalid JSON',
          description: 'Please provide valid JSON payload',
          variant: 'destructive',
        });
        return;
      }

      if (!signature.trim()) {
        toast({
          title: 'Missing Signature',
          description: 'Please provide a webhook signature',
          variant: 'destructive',
        });
        return;
      }

      // Call edge function to verify signature
      const { data, error } = await supabase.functions.invoke('verify-yoco-signature', {
        body: {
          payload,
          signature,
        },
      });

      if (error) {
        throw error;
      }

      setResult({
        valid: data.valid,
        message: data.message,
      });

      toast({
        title: data.valid ? 'Valid Signature' : 'Invalid Signature',
        description: data.message,
        variant: data.valid ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Failed to test webhook signature',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTestSignature = async () => {
    try {
      setLoading(true);

      // Validate JSON
      try {
        JSON.parse(payload);
      } catch (e) {
        toast({
          title: 'Invalid JSON',
          description: 'Please provide valid JSON payload',
          variant: 'destructive',
        });
        return;
      }

      // Call edge function to generate test signature
      const { data, error } = await supabase.functions.invoke('verify-yoco-signature', {
        body: {
          payload,
          generateSignature: true,
        },
      });

      if (error) {
        throw error;
      }

      setSignature(data.signature);

      toast({
        title: 'Test Signature Generated',
        description: 'You can now test the webhook with this signature',
      });
    } catch (error) {
      console.error('Error generating signature:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate test signature',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yoco Webhook Signature Tester</CardTitle>
        <CardDescription>
          Test webhook signature validation to ensure proper integration with Yoco payment webhooks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="payload">Webhook Payload (JSON)</Label>
          <Textarea
            id="payload"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder='{"type": "payment.succeeded", "payload": {...}}'
            className="font-mono text-sm min-h-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            Enter the raw JSON payload that would be sent by Yoco webhook
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signature">X-Yoco-Signature Header</Label>
          <div className="flex gap-2">
            <Input
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Enter webhook signature or generate a test one"
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              onClick={handleGenerateTestSignature}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Test'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The HMAC SHA-256 signature sent in the X-Yoco-Signature header
          </p>
        </div>

        <Button onClick={handleTest} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            'Verify Signature'
          )}
        </Button>

        {result && (
          <Alert variant={result.valid ? 'default' : 'destructive'}>
            <div className="flex items-start gap-3">
              {result.valid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  {result.valid ? 'Valid Signature' : 'Invalid Signature'}
                </h4>
                <AlertDescription>{result.message}</AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold mb-2">Testing Tips:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Click "Generate Test" to create a valid signature for your payload</li>
            <li>The signature is computed using HMAC SHA-256 with your webhook secret</li>
            <li>Test with actual webhook payloads from Yoco to verify integration</li>
            <li>Invalid signatures will be rejected by the webhook endpoint</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
