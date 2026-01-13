import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  Eye, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Thermometer,
  Droplets,
  Wind,
  Cloud,
  CloudRain,
  Snowflake,
  Gauge
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { logAdminAction } from '@/lib/admin';

interface DisputedVerification {
  id: string;
  city: string;
  category: string;
  primary_value: string;
  secondary_value: string;
  deviation_percentage: number;
  resolution_method: string | null;
  final_value: string | null;
  verification_time: string;
  metadata: any;
}

interface AffectedBet {
  id: string;
  user_id: string;
  city: string;
  prediction_type: string;
  prediction_value: string;
  stake: number;
  odds: number;
  result: string;
  currency_type: string;
  created_at: string;
  username?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  temperature: <Thermometer className="h-4 w-4" />,
  humidity: <Droplets className="h-4 w-4" />,
  wind: <Wind className="h-4 w-4" />,
  pressure: <Gauge className="h-4 w-4" />,
  cloud_coverage: <Cloud className="h-4 w-4" />,
  rain: <CloudRain className="h-4 w-4" />,
  rainfall: <CloudRain className="h-4 w-4" />,
  snow: <Snowflake className="h-4 w-4" />,
};

const categoryUnits: Record<string, string> = {
  temperature: '°C',
  humidity: '%',
  wind: 'km/h',
  pressure: 'hPa',
  cloud_coverage: '%',
  rain: '',
  rainfall: 'mm',
  snow: '',
};

export const DisputeResolution = () => {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<DisputedVerification[]>([]);
  const [affectedBets, setAffectedBets] = useState<AffectedBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<DisputedVerification | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSource, setOverrideSource] = useState<'primary' | 'secondary' | 'manual' | 'average'>('average');
  const [processing, setProcessing] = useState(false);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      // Load disputed verifications
      const { data: disputeData, error } = await supabase
        .from('weather_verification_log')
        .select('*')
        .eq('is_disputed', true)
        .order('verification_time', { ascending: false })
        .limit(100);

      if (error) throw error;
      setDisputes(disputeData || []);

      // Load potentially affected pending bets
      const { data: betsData } = await supabase
        .from('bets')
        .select('*, users!bets_user_id_fkey(username)')
        .eq('result', 'pending')
        .order('created_at', { ascending: false });

      const formattedBets = (betsData || []).map((bet: any) => ({
        ...bet,
        username: bet.users?.username || 'Unknown',
      }));
      setAffectedBets(formattedBets);
    } catch (error) {
      console.error('Error loading disputes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dispute data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  const openReviewDialog = (dispute: DisputedVerification) => {
    setSelectedDispute(dispute);
    setOverrideValue(dispute.final_value || '');
    setOverrideReason('');
    setOverrideSource('average');
    setReviewDialogOpen(true);
  };

  const handleOverride = async () => {
    if (!selectedDispute) return;
    
    setProcessing(true);
    try {
      // Update the verification log with admin override
      const { error: updateError } = await supabase
        .from('weather_verification_log')
        .update({
          final_value: overrideValue,
          resolution_method: `admin_override_${overrideSource}`,
          metadata: {
            ...selectedDispute.metadata,
            admin_override: {
              original_final_value: selectedDispute.final_value,
              new_value: overrideValue,
              reason: overrideReason,
              source: overrideSource,
              timestamp: new Date().toISOString(),
            },
          },
        })
        .eq('id', selectedDispute.id);

      if (updateError) throw updateError;

      // Log admin action
      await logAdminAction(
        'dispute_override',
        'weather_verification_log',
        selectedDispute.id,
        {
          city: selectedDispute.city,
          category: selectedDispute.category,
          original_value: selectedDispute.final_value,
          new_value: overrideValue,
          reason: overrideReason,
          source: overrideSource,
        }
      );

      toast({
        title: 'Dispute Resolved',
        description: `Successfully overrode ${selectedDispute.category} for ${selectedDispute.city}`,
      });

      setReviewDialogOpen(false);
      await loadDisputes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to override dispute',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkResolve = async (action: 'use_primary' | 'use_secondary' | 'use_average') => {
    setProcessing(true);
    try {
      for (const dispute of disputes) {
        let newValue: string;
        
        switch (action) {
          case 'use_primary':
            newValue = dispute.primary_value;
            break;
          case 'use_secondary':
            newValue = dispute.secondary_value;
            break;
          case 'use_average':
          default:
            const primary = parseFloat(dispute.primary_value);
            const secondary = parseFloat(dispute.secondary_value);
            if (!isNaN(primary) && !isNaN(secondary)) {
              newValue = ((primary + secondary) / 2).toFixed(1);
            } else {
              newValue = dispute.primary_value;
            }
            break;
        }

        await supabase
          .from('weather_verification_log')
          .update({
            final_value: newValue,
            resolution_method: `bulk_${action}`,
            is_disputed: false,
          })
          .eq('id', dispute.id);
      }

      await logAdminAction(
        'bulk_dispute_resolution',
        'weather_verification_log',
        undefined,
        {
          action,
          count: disputes.length,
        }
      );

      toast({
        title: 'Bulk Resolution Complete',
        description: `Resolved ${disputes.length} disputes using ${action.replace('_', ' ')}`,
      });

      await loadDisputes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to bulk resolve disputes',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getRelatedBets = (dispute: DisputedVerification) => {
    return affectedBets.filter(
      bet => bet.city === dispute.city && 
             bet.prediction_type.toLowerCase().includes(dispute.category.toLowerCase())
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Loading dispute data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-yellow-500" />
              Active Disputes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{disputes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Affected Pending Bets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {disputes.reduce((sum, d) => sum + getRelatedBets(d).length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Cities Affected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(disputes.map(d => d.city)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {disputes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bulk Actions</CardTitle>
            <CardDescription>
              Apply resolution to all {disputes.length} disputes at once
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleBulkResolve('use_primary')}
              disabled={processing}
            >
              Use All Primary Values
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBulkResolve('use_secondary')}
              disabled={processing}
            >
              Use All Secondary Values
            </Button>
            <Button
              onClick={() => handleBulkResolve('use_average')}
              disabled={processing}
            >
              Use All Averages
            </Button>
            <Button variant="ghost" onClick={loadDisputes} disabled={processing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Disputes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Weather Disputes</CardTitle>
          <CardDescription>
            Review and resolve discrepancies between weather sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Active Disputes</h3>
              <p className="text-muted-foreground">
                All weather data sources are in agreement
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Primary (OpenWeather)</TableHead>
                  <TableHead>Secondary (WeatherAPI)</TableHead>
                  <TableHead>Deviation</TableHead>
                  <TableHead>Current Resolution</TableHead>
                  <TableHead>Affected Bets</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => {
                  const relatedBets = getRelatedBets(dispute);
                  const unit = categoryUnits[dispute.category] || '';
                  const icon = categoryIcons[dispute.category];
                  
                  return (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-medium">{dispute.city}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {icon}
                          <span className="capitalize">{dispute.category.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {dispute.primary_value}{unit}
                      </TableCell>
                      <TableCell>
                        {dispute.secondary_value}{unit}
                      </TableCell>
                      <TableCell>
                        <Badge variant={dispute.deviation_percentage > 20 ? 'destructive' : 'secondary'}>
                          {dispute.deviation_percentage.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{dispute.final_value}{unit}</span>
                          <span className="text-xs text-muted-foreground">
                            {dispute.resolution_method?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {relatedBets.length > 0 ? (
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            {relatedBets.length} bet{relatedBets.length > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(dispute.verification_time), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReviewDialog(dispute)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-yellow-500" />
              Review Weather Dispute
            </DialogTitle>
            <DialogDescription>
              {selectedDispute?.city} - {selectedDispute?.category.replace('_', ' ')}
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <div className="space-y-6">
              {/* Source Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">OpenWeatherMap</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedDispute.primary_value}
                      {categoryUnits[selectedDispute.category]}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-purple-500/30 bg-purple-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">WeatherAPI</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedDispute.secondary_value}
                      {categoryUnits[selectedDispute.category]}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Deviation Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Deviation</span>
                  <Badge variant={selectedDispute.deviation_percentage > 20 ? 'destructive' : 'secondary'}>
                    {selectedDispute.deviation_percentage.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Auto-Resolution</span>
                  <span className="text-sm font-medium capitalize">
                    {selectedDispute.resolution_method?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Override Options */}
              <div className="space-y-4">
                <div>
                  <Label>Resolution Source</Label>
                  <Select value={overrideSource} onValueChange={(v: any) => {
                    setOverrideSource(v);
                    if (v === 'primary') setOverrideValue(selectedDispute.primary_value);
                    if (v === 'secondary') setOverrideValue(selectedDispute.secondary_value);
                    if (v === 'average') {
                      const p = parseFloat(selectedDispute.primary_value);
                      const s = parseFloat(selectedDispute.secondary_value);
                      if (!isNaN(p) && !isNaN(s)) {
                        setOverrideValue(((p + s) / 2).toFixed(1));
                      }
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Use Primary (OpenWeatherMap)</SelectItem>
                      <SelectItem value="secondary">Use Secondary (WeatherAPI)</SelectItem>
                      <SelectItem value="average">Use Average</SelectItem>
                      <SelectItem value="manual">Manual Override</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Final Value</Label>
                  <Input
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    disabled={overrideSource !== 'manual'}
                    placeholder={`Enter value in ${categoryUnits[selectedDispute.category] || 'units'}`}
                  />
                </div>

                <div>
                  <Label>Reason for Override (Optional)</Label>
                  <Textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Explain why this value was chosen..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Affected Bets */}
              {getRelatedBets(selectedDispute).length > 0 && (
                <div>
                  <Label className="mb-2 block">Potentially Affected Bets</Label>
                  <div className="max-h-40 overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Prediction</TableHead>
                          <TableHead>Stake</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getRelatedBets(selectedDispute).map((bet) => (
                          <TableRow key={bet.id}>
                            <TableCell>{bet.username}</TableCell>
                            <TableCell>{bet.prediction_value}</TableCell>
                            <TableCell>{bet.stake}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOverride} disabled={processing || !overrideValue}>
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Apply Override
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisputeResolution;
