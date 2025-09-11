import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LucideIcon, ChevronRight } from "lucide-react";

interface NavigationItem {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  description?: string;
}

interface NavigationCardProps {
  title?: string;
  items: NavigationItem[];
  variant?: "default" | "grid" | "list";
  orientation?: "horizontal" | "vertical";
}

export function NavigationCard({ 
  title, 
  items, 
  variant = "default",
  orientation = "vertical" 
}: NavigationCardProps) {
  const handleItemClick = (item: NavigationItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      window.location.href = item.href;
    }
  };

  if (variant === "grid") {
    return (
      <Card className="bg-card border-border/50">
        {title && (
          <div className="p-4 pb-2">
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
        )}
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-accent"
                onClick={() => handleItemClick(item)}
              >
                {item.icon && <item.icon className="h-6 w-6 text-primary" />}
                <div className="text-center">
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "list") {
    return (
      <Card className="bg-card border-border/50">
        {title && (
          <div className="p-4 pb-2 border-b border-border">
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
        )}
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {items.map((item, index) => (
              <button
                key={index}
                className="w-full p-4 flex items-center justify-between hover:bg-accent transition-colors text-left"
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center space-x-3">
                  {item.icon && <item.icon className="h-5 w-5 text-primary" />}
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    {item.description && (
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {item.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50">
      {title && (
        <div className="p-4 pb-2">
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
      )}
      <CardContent className="p-4 pt-2">
        <div className={`flex ${orientation === "horizontal" ? "flex-row space-x-2" : "flex-col space-y-2"}`}>
          {items.map((item, index) => (
            <Button
              key={index}
              variant="ghost"
              className={`${orientation === "horizontal" ? "flex-1" : "w-full"} justify-start h-auto p-3`}
              onClick={() => handleItemClick(item)}
            >
              <div className="flex items-center space-x-3 w-full">
                {item.icon && <item.icon className="h-5 w-5 text-primary" />}
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{item.label}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  )}
                </div>
                {item.badge && (
                  <Badge variant="secondary" className="text-xs ml-2">
                    {item.badge}
                  </Badge>
                )}
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}