import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Cloud,
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  CloudRain,
  Snowflake
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface VerificationResult {
  category: string;
  primary_value: string;
  secondary_value: string;
  deviation_percentage: number;
  is_disputed: boolean;
  resolution_method?: string;
  final_value?: string;
  confidence_score: number;
}

interface VerificationResponse {
  city: string;
  verified_at: string;
  sources: {
    primary: string;
    secondary: string;
  };
  results: VerificationResult[];
  summary: {
    total_categories: number;
    disputed_count: number;
    disputed_categories: string[];
    average_confidence: number;
    all_sources_available: boolean;
  };
  verified_values: Record<string, string>;
}

interface WeatherVerificationProps {
  city: string;
  categories?: string[];
  showDetails?: boolean;
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

const categoryLabels: Record<string, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  wind: 'Wind Speed',
  pressure: 'Pressure',
  cloud_coverage: 'Cloud Coverage',
  rain: 'Rain',
  rainfall: 'Rainfall Amount',
  snow: 'Snow',
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

export const WeatherVerification = ({ 
  city, 
  categories, 
  showDetails = true 
}: WeatherVerificationProps) => {
  const [verification, setVerification] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVerification = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-weather', {
        body: { city, categories },
      });
      
      if (fnError) throw fnError;
      setVerification(data);
    } catch (err) {
      console.error('Verification error:', err);
      setError('Failed to verify weather data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (city) {
      fetchVerification();
    }
  }, [city]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-500';
    if (confidence >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return 'default';
    if (confidence >= 70) return 'secondary';
    return 'destructive';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Verifying weather sources...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <ShieldAlert className="h-6 w-6 text-destructive mr-2" />
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" className="ml-4" onClick={fetchVerification}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!verification) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {verification.summary.disputed_count === 0 ? (
              <ShieldCheck className="h-5 w-5 text-green-500" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-yellow-500" />
            )}
            <CardTitle className="text-lg">Weather Verification</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchVerification}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{city}</span>
          <span>•</span>
          <span>
            {format(new Date(verification.verified_at), 'MMM d, h:mm a')}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className={`text-2xl font-bold ${getConfidenceColor(verification.summary.average_confidence)}`}>
              {verification.summary.average_confidence}%
            </div>
            <div className="text-xs text-muted-foreground">Confidence</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">
              {verification.summary.total_categories - verification.summary.disputed_count}
            </div>
            <div className="text-xs text-muted-foreground">Matched</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className={`text-2xl font-bold ${verification.summary.disputed_count > 0 ? 'text-yellow-500' : ''}`}>
              {verification.summary.disputed_count}
            </div>
            <div className="text-xs text-muted-foreground">Disputed</div>
          </div>
        </div>

        {/* Sources */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sources:</span>
          <Badge variant="outline">{verification.sources.primary}</Badge>
          {verification.sources.secondary !== 'unavailable' ? (
            <Badge variant="outline">{verification.sources.secondary}</Badge>
          ) : (
            <Badge variant="secondary">Secondary unavailable</Badge>
          )}
        </div>

        {/* Details */}
        {showDetails && (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">All Categories</TabsTrigger>
              <TabsTrigger value="disputed" className="relative">
                Disputed
                {verification.summary.disputed_count > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                    {verification.summary.disputed_count}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
              <div className="space-y-2">
                {verification.results.map((result) => (
                  <VerificationRow key={result.category} result={result} />
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="disputed" className="mt-4">
              <div className="space-y-2">
                {verification.results
                  .filter(r => r.is_disputed)
                  .map((result) => (
                    <VerificationRow key={result.category} result={result} expanded />
                  ))}
                {verification.summary.disputed_count === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>All weather sources agree!</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

interface VerificationRowProps {
  result: VerificationResult;
  expanded?: boolean;
}

const VerificationRow = ({ result, expanded = false }: VerificationRowProps) => {
  const icon = categoryIcons[result.category] || <Cloud className="h-4 w-4" />;
  const label = categoryLabels[result.category] || result.category;
  const unit = categoryUnits[result.category] || '';
  
  return (
    <div className={`p-3 rounded-lg border ${result.is_disputed ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
          {result.is_disputed && (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
              Disputed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result.is_disputed ? (
            <span className="font-semibold">
              {result.final_value}{unit}
            </span>
          ) : (
            <span className="font-semibold">
              {result.primary_value}{unit}
            </span>
          )}
          <Badge variant={result.confidence_score >= 90 ? 'default' : result.confidence_score >= 70 ? 'secondary' : 'destructive'}>
            {result.confidence_score}%
          </Badge>
        </div>
      </div>
      
      {(expanded || result.is_disputed) && (
        <div className="mt-3 pt-3 border-t text-sm space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-muted-foreground">OpenWeatherMap:</span>
              <span className="ml-2 font-medium">{result.primary_value}{unit}</span>
            </div>
            <div>
              <span className="text-muted-foreground">WeatherAPI:</span>
              <span className="ml-2 font-medium">{result.secondary_value}{unit}</span>
            </div>
          </div>
          {result.resolution_method && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>Resolved using: {result.resolution_method.replace(/_/g, ' ')}</span>
            </div>
          )}
          <Progress 
            value={result.confidence_score} 
            className="h-1"
          />
        </div>
      )}
    </div>
  );
};

export default WeatherVerification;
