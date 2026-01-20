import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  name?: string | null;
  image?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

export function UserAvatar({
  name,
  image,
  className,
  size = "md",
}: UserAvatarProps) {
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Avatar className={`${sizeClasses[size]} ${className ?? ""}`}>
      <AvatarImage src={image ?? undefined} alt={name ?? "User avatar"} />
      <AvatarFallback className="bg-primary text-primary-foreground font-medium">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
