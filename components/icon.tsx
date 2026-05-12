type IconProps = {
  name: string;
  className?: string;
  fill?: boolean;
};

export function Icon({ name, className = "", fill }: IconProps) {
  return <span className={`material-symbols-outlined ${fill ? "icon-fill" : ""} ${className}`}>{name}</span>;
}
