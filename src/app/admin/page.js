import AdminDashboard from "@/components/admin/AdminDashboard";

export const metadata = {
  title: "Matchmake Owner Admin",
  description: "Owner-only Matchmake operations dashboard.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
