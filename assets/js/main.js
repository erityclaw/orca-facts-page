const randomFacts = [
  "Orca pods can have distinctive vocal dialects that are passed from generation to generation.",
  "Some ecotypes specialize so strongly in prey type that neighboring orca communities may avoid eating the same food.",
  "Post-reproductive female orcas can improve the survival odds of younger relatives by sharing ecological memory.",
  "Orcas have one of the most complex social systems known among marine mammals.",
  "Cooperative hunting lets orcas solve problems that would be difficult for a lone predator.",
  "Young orcas learn by watching, copying, and practicing inside their pod, not by instinct alone."
];

const factTarget = document.getElementById('random-fact');
const factButton = document.getElementById('fact-button');

if (factTarget && factButton) {
  factButton.addEventListener('click', () => {
    const pick = randomFacts[Math.floor(Math.random() * randomFacts.length)];
    factTarget.textContent = pick;
  });
}

const yearTarget = document.getElementById('year');
if (yearTarget) yearTarget.textContent = new Date().getFullYear();
