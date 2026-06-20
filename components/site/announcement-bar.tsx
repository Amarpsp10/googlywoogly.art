import Link from "next/link";
import { getSiteSettings } from "@/lib/services/settings";
import type { AnnouncementBar as AnnouncementBarShape } from "@/types";

export async function AnnouncementBar() {
  const settings = await getSiteSettings();
  const bar = settings?.announcementBar as AnnouncementBarShape | null | undefined;
  if (!bar?.enabled || !bar.text) return null;

  const content = (
    <span className="block py-2 text-center text-sm font-medium text-primary-foreground">
      {bar.text}
    </span>
  );

  return (
    <div className="bg-primary">
      {bar.href ? (
        <Link href={bar.href} className="block hover:opacity-90">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
