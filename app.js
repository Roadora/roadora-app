let roadoraOriginPlace = null;
let roadoraDestinationPlace = null;

window.initRoadoraAutocomplete = async function () {
  if (!window.google || !google.maps || !google.maps.importLibrary) return;

  const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");

  const originHolder = document.getElementById("originAutocomplete");
  const destinationHolder = document.getElementById("destinationAutocomplete");

  if (!originHolder || !destinationHolder) return;

  originHolder.innerHTML = "";
  destinationHolder.innerHTML = "";

  const originInput = new PlaceAutocompleteElement({
    placeholder: "Waar vertrek je?",
    requestedLanguage: "nl",
    requestedRegion: "nl"
  });

  const destinationInput = new PlaceAutocompleteElement({
    placeholder: "Waar wil je heen?",
    requestedLanguage: "nl",
    requestedRegion: "nl"
  });

  originHolder.appendChild(originInput);
  destinationHolder.appendChild(destinationInput);

  originInput.addEventListener("gmp-select", async (event) => {
    const place = event.placePrediction.toPlace();

    await place.fetchFields({
      fields: ["displayName", "formattedAddress", "location"]
    });

    roadoraOriginPlace = {
      name: place.displayName,
      address: place.formattedAddress,
      lat: place.location.lat(),
      lng: place.location.lng()
    };

    console.log("Roadora vertrek:", roadoraOriginPlace);
  });

  destinationInput.addEventListener("gmp-select", async (event) => {
    const place = event.placePrediction.toPlace();

    await place.fetchFields({
      fields: ["displayName", "formattedAddress", "location"]
    });

    roadoraDestinationPlace = {
      name: place.displayName,
      address: place.formattedAddress,
      lat: place.location.lat(),
      lng: place.location.lng()
    };

    console.log("Roadora bestemming:", roadoraDestinationPlace);
  });
};

function validateRoadoraRoute() {
  if (!roadoraOriginPlace || !roadoraDestinationPlace) {
    alert("Kies eerst een geldig vertrekpunt en bestemming");
    return false;
  }

  return true;
}
