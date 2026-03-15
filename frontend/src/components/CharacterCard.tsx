"use client";

type Character = {
  name: string;
  role: string;
  description: string;
  image: string;
};

export default function CharacterCard({ character }: { character: any }) {
return (

<div className="character-card">

<div className="character-avatar">
<img src={character.avatar} />
</div>

<div className="character-name">
{character.name}
</div>

<div className="character-meta">
<span>{character.class}</span>
<span>{character.subclass}</span>
</div>

<div className="character-meta">
<span>{character.race}</span>
<span>{character.subrace}</span>
</div>

<div className={`status ${character.status}`}>
{character.status}
</div>

<p className="character-backstory">
{character.backstory}
</p>

</div>
);
}