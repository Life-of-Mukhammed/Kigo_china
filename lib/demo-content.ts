import { findRecord, recordWrite, removeRecord, writeRecords } from "@/lib/record-store";

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
};

export async function ensureDemoContent() {
  if (await findRecord("system:demo-content-v2")) return;
  const today = new Date();
  const pastStart = addDays(today, -20);
  const pastEnd = addDays(today, -19);
  const futureEnd = addDays(today, 90);
  const organizers = [
    { id: "demo-organizer-1", name: "Demo tashkilot — Toshkent futbol klubi", city: "Toshkent", sport: "Futbol", description: "KiGo sahifalari uchun demo tashkilot profili.", image: "/media/football.webp" },
    { id: "demo-organizer-2", name: "Demo tashkilot — Samarqand tennis markazi", city: "Samarqand", sport: "Tennis", description: "KiGo sahifalari uchun demo tashkilot profili.", image: "/media/tennis.webp" },
    { id: "demo-organizer-3", name: "Demo tashkilot — Buxoro basketbol maktabi", city: "Buxoro", sport: "Basketbol", description: "KiGo sahifalari uchun demo tashkilot profili.", image: "/media/basketball.webp" },
    { id: "demo-organizer-4", name: "Demo tashkilot — Farg‘ona padel klubi", city: "Farg‘ona", sport: "Padel", description: "KiGo sahifalari uchun demo tashkilot profili.", image: "/media/padel.webp" },
    { id: "demo-organizer-5", name: "Demo tashkilot — Andijon voleybol markazi", city: "Andijon", sport: "Voleybol", description: "KiGo sahifalari uchun demo tashkilot profili.", image: "/media/volleyball.webp" },
  ];
  const tournaments = [
    { id: "demo-tournament-1", name: "Demo: Toshkent kuzgi futbol kubogi", sport: "Futbol", city: "Toshkent", address: "Yunusobod sport majmuasi", image: "/media/football.webp", format: "team", capacity: 16, price: 0, prize: "Demo sovrin jamg‘armasi", organizerId: organizers[0].id },
    { id: "demo-tournament-2", name: "Demo: Samarqand tennis ochiq turniri", sport: "Tennis", city: "Samarqand", address: "Registon tennis korti", image: "/media/tennis.webp", format: "solo", capacity: 32, price: 25000, prize: "Demo sovrin jamg‘armasi", organizerId: organizers[1].id },
    { id: "demo-tournament-3", name: "Demo: Buxoro 3x3 basketbol", sport: "Basketbol", city: "Buxoro", address: "Markaziy sport saroyi", image: "/media/basketball.webp", format: "team", capacity: 12, price: 0, prize: "Demo sovrin jamg‘armasi", organizerId: organizers[2].id },
    { id: "demo-tournament-4", name: "Demo: Farg‘ona padel chempionati", sport: "Padel", city: "Farg‘ona", address: "Yangi hayot padel korti", image: "/media/padel.webp", format: "team", capacity: 16, price: 50000, prize: "Demo sovrin jamg‘armasi", organizerId: organizers[3].id },
    { id: "demo-tournament-5", name: "Demo: Andijon voleybol ligasi", sport: "Voleybol", city: "Andijon", address: "Bobur sport majmuasi", image: "/media/volleyball.webp", format: "team", capacity: 10, price: 0, prize: "Demo sovrin jamg‘armasi", organizerId: organizers[4].id },
  ];
  const reviews = organizers.map((organizer, index) => ({
    id: `demo-review-${index + 1}`,
    owner: `demo-reviewer-${index + 1}`,
    target: organizer.id,
    data: {
      demo: true,
      name: `Demo ishtirokchi ${index + 1}`,
      who: `Demo ishtirokchi ${index + 1}`,
      rating: [5, 4, 5, 4, 5][index],
      title: "Demo fikr",
      text: "Bu haqiqiy foydalanuvchi sharhi emas — sahifa ko‘rinishini namoyish qiluvchi demo matn.",
      status: "approved",
      updatedAt: today.toISOString(),
    },
  }));
  const sports = ["Futbol", "Tennis", "Basketbol", "Padel", "Voleybol"];
  const images = ["football", "tennis", "basketball", "padel", "volleyball"];
  const writes = [
    ...organizers.map((organizer) => recordWrite(
      organizer.id,
      "organizer",
      "kigo-demo",
      organizer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      { ...organizer, slug: organizer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), phone: "", email: "", website: "", verified: false, demo: true },
      { insertOnly: true },
    )),
    ...tournaments.map((tournament, index) => recordWrite(
      tournament.id,
      "tournament",
      "kigo-demo",
      tournament.city,
      {
        ...tournament,
        description: "Demo turnir — namunaviy sahifa ma’lumoti.",
        startDate: pastStart,
        endDate: pastEnd,
        registrationDeadline: addDays(today, -21),
        rules: "Demo ma’lumoti.",
        status: "tugagan",
        demo: true,
        slug: `demo-${sports[index].toLowerCase()}-${index + 1}`,
      },
      { insertOnly: true },
    )),
    ...reviews.map((review) => recordWrite(review.id, "review", review.owner, review.target, review.data, { insertOnly: true })),
    ...sports.slice(0, 1).map((sport, index) => recordWrite(
      `demo-ad-${index + 1}`,
      "ad",
      "kigo-demo",
      "demo",
      {
        name: `Demo reklama ${index + 1}`,
        title: `Demo ${sport} mahsulotlari`,
        subtitle: "Namuna reklama — demo kontent.",
        image: `/media/${images[index]}.webp`,
        url: "/turnirlar",
        buttonLabel: "Ko‘rish",
        slot: index === 0 ? "hero" : "banner",
        status: "active",
        startDate: addDays(today, -1),
        endDate: futureEnd,
        priority: 5 - index,
        demo: true,
      },
      { insertOnly: true },
    )),
  ];
  await Promise.all(writes.map((write) => writeRecords([write])));
  await Promise.all([2, 3, 4, 5].map((number) => removeRecord(`demo-ad-${number}`, "ad")));
  await writeRecords([recordWrite("system:demo-content-v2", "system", "system", "", { version: 2 })]);
}
