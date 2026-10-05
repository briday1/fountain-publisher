import { UserRound } from "lucide-react";

export function AccountAvatar({
  name,
  email,
}: {
  name?: string;
  email?: string;
}) {
  const words = name?.trim().split(/\s+/).filter(Boolean);
  const initials = words?.length
    ? (words[0][0] + (words.length > 1 ? words.at(-1)![0] : "")).toUpperCase()
    : email?.slice(0, 1).toUpperCase();
  return (
    <span className="account-avatar" aria-hidden="true">
      {initials || <UserRound size={19} />}
    </span>
  );
}
