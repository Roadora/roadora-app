window.initRoadoraAutocomplete = async function () {

  if (!window.google || !google.maps) {
    console.log("Google Maps nog niet geladen");
    return;
  }

  const { PlaceAutocompleteElement } =
    await google.maps.importLibrary("places");

  const originContainer =
    document.getElementById("originAutocomplete");

  const destinationContainer =
    document.getElementById("destinationAutocomplete");

  const originAutocomplete =
    new PlaceAutocompleteElement();

  const destinationAutocomplete =
    new PlaceAutocompleteElement();

  originContainer.appendChild(originAutocomplete);
  destinationContainer.appendChild(destinationAutocomplete);

  console.log("Roadora autocomplete geladen");
};

document
  .getElementById("planRouteBtn")
  .addEventListener("click", () => {

    alert(
      "Roadora route flow actief 🚗"
    );

  });
