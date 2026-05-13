import { LoginPanel } from "@/components/login-panel";

type LoginPageProps = {
  searchParams: {
    mode?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return <LoginPanel initialMode={searchParams.mode === "signup" ? "signup" : "login"} />;
}
