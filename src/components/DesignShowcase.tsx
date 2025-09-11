import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Tablet, Monitor, Grid3X3, Palette } from 'lucide-react';

// Import the generated design assets
import mobileImage from '@/assets/mobile-mockup.png';
import tabletImage from '@/assets/tablet-mockup.png';
import desktopImage from '@/assets/desktop-mockup.png';
import wireframesImage from '@/assets/wireframes-responsive.png';
import componentsImage from '@/assets/component-library.png';

interface DesignShowcaseProps {
  onBack: () => void;
}

const DesignShowcase = ({ onBack }: DesignShowcaseProps) => {
  const designs = [
    {
      id: 'mobile',
      title: 'Mobile Design',
      description: 'Responsive mobile interface optimized for touch interactions',
      image: mobileImage,
      dimensions: '375 × 812px',
      breakpoint: 'sm (640px and below)',
      icon: Smartphone,
      features: [
        'Touch-friendly button sizing',
        'Vertical card stack layout',
        'Simplified navigation',
        'Optimized for one-handed use'
      ]
    },
    {
      id: 'tablet',
      title: 'Tablet Design', 
      description: 'Enhanced layout utilizing tablet screen real estate',
      image: tabletImage,
      dimensions: '768 × 1024px',
      breakpoint: 'md (768px - 1024px)',
      icon: Tablet,
      features: [
        'Multi-column grid layouts',
        'Enhanced data visualization',
        'Larger interactive elements',
        'Optimized for landscape viewing'
      ]
    },
    {
      id: 'desktop',
      title: 'Desktop Design',
      description: 'Full-featured desktop experience with advanced UI',
      image: desktopImage,
      dimensions: '1440 × 900px',
      breakpoint: 'lg (1024px and above)',
      icon: Monitor,
      features: [
        'Sidebar navigation',
        'Advanced data tables',
        'Multi-panel layouts',
        'Rich hover interactions'
      ]
    },
    {
      id: 'wireframes',
      title: 'Responsive Wireframes',
      description: 'Information architecture and layout structure',
      image: wireframesImage,
      dimensions: 'All breakpoints',
      breakpoint: 'Responsive system',
      icon: Grid3X3,
      features: [
        'Content hierarchy',
        'Component placement',
        'Navigation flow',
        'Responsive grid system'
      ]
    },
    {
      id: 'components',
      title: 'Component Library',
      description: 'Reusable UI components and design system',
      image: componentsImage,
      dimensions: 'Component scale',
      breakpoint: 'Design system',
      icon: Palette,
      features: [
        'Consistent styling',
        'Light/dark themes',
        'Interactive states',
        'Accessibility focused'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Design System & Mockups</h1>
            <p className="text-muted-foreground">
              Responsive designs across mobile, tablet, and desktop breakpoints
            </p>
          </div>
        </div>

        {/* Design Tabs */}
        <Tabs defaultValue="mobile" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {designs.map((design) => {
              const IconComponent = design.icon;
              return (
                <TabsTrigger key={design.id} value={design.id} className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4" />
                  <span className="hidden sm:inline">{design.title}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {designs.map((design) => {
            const IconComponent = design.icon;
            return (
              <TabsContent key={design.id} value={design.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-6 w-6 text-primary" />
                        <div>
                          <CardTitle>{design.title}</CardTitle>
                          <CardDescription>{design.description}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant="outline">{design.dimensions}</Badge>
                        <p className="text-sm text-muted-foreground">{design.breakpoint}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Design Image */}
                    <div className="bg-muted/30 rounded-lg p-4 mb-6">
                      <img 
                        src={design.image} 
                        alt={`${design.title} mockup`}
                        className="w-full h-auto rounded-lg shadow-lg"
                      />
                    </div>

                    {/* Features */}
                    <div>
                      <h3 className="font-semibold mb-3">Key Features</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {design.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary rounded-full" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Design Principles */}
        <Card>
          <CardHeader>
            <CardTitle>Design Principles</CardTitle>
            <CardDescription>
              Core principles guiding the weather betting app interface
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-primary">Responsive First</h3>
                <p className="text-sm text-muted-foreground">
                  Designed mobile-first with progressive enhancement for larger screens
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-primary">Accessibility</h3>
                <p className="text-sm text-muted-foreground">
                  WCAG compliant with proper contrast, keyboard navigation, and screen reader support
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-primary">Performance</h3>
                <p className="text-sm text-muted-foreground">
                  Optimized for fast loading with efficient component architecture
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DesignShowcase;