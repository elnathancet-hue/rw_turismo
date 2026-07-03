import { FaceFrownIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import Drawer from "../components/Drawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import InfoCard from "../components/InfoCard";
import MapCard from "../components/MapCard";
import { signOutFromSupabase } from "../lib/auth/client";
import { IResult, ISuggestionFormatted } from "../types/typings";
import getHotelList from "../utils/getHotelList";

type Props = {
  searchResults: IResult[];
};

const Search = ({ searchResults }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );
  const router = useRouter();
  const { id, location, startDate, endDate, numOfGuests } = router.query;
  const formattedStartDate = format(
    new Date(startDate as string),
    "dd MMMM yy"
  );
  const formattedEndDate = format(new Date(endDate as string), "dd MMMM yy");
  const range = `from ${formattedStartDate} to ${formattedEndDate}`;

  return (
    <div>
      <Header
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        placeholder={`${location} - ${range} - ${numOfGuests}`}
      />
      <main
        className={`flex ${!searchResults && "flex-col max-w-4xl mx-auto"}`}
      >
        {/* Left Section */}
        <section className="flex-grow pt-14 px-6">
          <p className="text-xs">
            {searchResults
              ? `Hospedagens disponíveis ${range}, ${numOfGuests} viajantes`
              : `No accommodations available ${range}, ${numOfGuests} guests`}
          </p>
          <h1 className="text-3xl font-semibold mt-2 mb-6">
            Stays in {location}
          </h1>

          {searchResults && (
            <div className="hidden lg:inline-flex mb-5 space-x-3 text-gray-800 whitespace-nowrap">
              <p className="button">Cancellation Flexibility</p>
              <p className="button">Price</p>
              <p className="button">Rooms and Beds</p>
              <p className="button">More filters</p>
            </div>
          )}
          <div className="flex flex-col">
            {/* Map Available Hotels */}
            {searchResults &&
              searchResults?.map((item) => (
                <InfoCard
                  key={item.img}
                  cityId={id as string}
                  item={item}
                  startDate={startDate as string}
                  endDate={endDate as string}
                  numOfGuests={numOfGuests as string}
                />
              ))}
          </div>
        </section>
        {/* MapBox, Right Section */}
        {searchResults ? (
          <section className="hidden lg:inline-flex xl:min-w-[600px]">
            <div className="sticky top-[68px] w-full h-screen">
              <MapCard searchResults={searchResults} />
            </div>
          </section>
        ) : (
          <div className="font-semilight max-w-sm mb-[155px] mx-auto text-center">
            <FaceFrownIcon className="mx-auto max-w-[300px]" />
            <p>
              {`Sorry, there are no accommodations available in ${location} ${range}. Please, try again on different dates.`}
            </p>
          </div>
        )}
      </main>
      <Footer />
      {/* Drawer Menu, hided by default */}
      <Drawer isOpen={isOpen} setIsOpen={setIsOpen}>
        <p className="drawer-item">
          <Link href={"/favorites"}>Meus favoritos</Link>
        </p>
        <p className="drawer-item">
          <Link href={"/bookings"}>Minhas reservas</Link>
        </p>
        <p onClick={() => signOutFromSupabase()} className="drawer-item">
          Sair
        </p>
      </Drawer>
    </div>
  );
};

export default Search;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const { id, location, startDate, endDate, numOfGuests } = context.query;

  const searchResults = await getHotelList(
    id,
    location,
    startDate,
    endDate,
    numOfGuests
  ).catch(console.error);

  if (!searchResults) {
    return {
      props: {},
    };
  }

  return {
    props: {
      searchResults,
    },
  };
};
