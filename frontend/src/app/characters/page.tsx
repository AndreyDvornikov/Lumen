import CharacterCard from "@/components/CharacterCard";

const characters = [
{
name: "НЕИЗВЕСТЕН",
class: "???",
subclass: "???",
race: "???",
subrace: "???",
status: "???",
avatar: "/characters/default1.png",
backstory:
"???"
},

{
name: "НЕИЗВЕСТЕН",
class: "???",
subclass: "???",
race: "???",
subrace: "???",
status: "???",
avatar: "/characters/default2.png",
backstory:
"???"
},

{
name: "НЕИЗВЕСТЕН",
class: "???",
subclass: "???",
race: "???",
subrace: "???",
status: "???",
avatar: "/characters/default3.png",
backstory:
"???"
},

{
name: "НЕИЗВЕСТЕН",
class: "???",
subclass: "???",
race: "???",
subrace: "???",
status: "???",
avatar: "/characters/default4.png",
backstory:
"???"
}
];

export default function CharactersPage() {
  return (
    <main className="characters-page">
      <div className="film-grain"></div>
      <div className="desk">
        {characters.map((c) => (
          <CharacterCard key={c.name} character={c} />
        ))}
      </div>
    </main>
  );
}