type IconProps = {
  name: string;
  className?: string;
  fill?: boolean;
};

export function Icon({ name, className = "", fill }: IconProps) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${fill ? "icon-fill" : ""} ${className}`}>
      {name}
    </span>
  );
}
