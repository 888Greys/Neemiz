import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: {
    mode?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  redirect(searchParams.mode === "signup" ? "/sign-up" : "/sign-in");
}
