import { HeartIcon } from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartIconSolid,
  StarIcon,
} from "@heroicons/react/24/solid";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader
import CarouselCard from "../components/CarouselCard";
import Drawer from "../components/Drawer";
import Footer from "../components/Footer";
import Header from "../components/Header";
import MapCard from "../components/MapCard";
import useSupabaseSession from "../hooks/useSupabaseSession";
import { signOutFromSupabase } from "../lib/auth/client";
import {
  addFavorite,
  isFavorite as checkIsFavorite,
  removeFavorite,
} from "../lib/favorites/client";
import { IDetails, IResult, ISuggestionFormatted } from "../types/typings";
import getHotelDetails from "../utils/getHotelDetails";

type Props = {
  detailsResult: IDetails;
};

const Details = ({ detailsResult }: Props) => {
  const { isAuthenticated } = useSupabaseSession();
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCity, setSelectedCity] = useState<ISuggestionFormatted | null>(
    null
  );
  const [isFav, setIsFav] = useState(false);
  const userEmail = "anonymous@user.com";
  const router = useRouter();
  const {
    cityId,
    favorite,
    fromFavPage,
    booking,
    startDate,
    endDate,
    numOfGuests,
    hotelId,
    img,
    location,
    title,
    description,
    star,
    price,
    total,
    long,
    lat,
  } = router.query;
  const searchResults: IResult[] = [
    {
      hotelId: hotelId as string,
      img: img as string,
      title: title as string,
      description: description as string,
      star: parseFloat(star as string),
      price: price as string,
      total: total as unknown as number,
      long: parseFloat(long as string),
      lat: parseFloat(lat as string),
      userEmail: userEmail as string,
    },
  ];
  console.log({ startDate, endDate });
  const formattedStartDate = startDate;
  const formattedEndDate = endDate;
  const range = `from ${formattedStartDate} to ${formattedEndDate}`;

  const getQueryValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const externalHotelId = getQueryValue(hotelId);

  // Update Fav State from Query Value
  useEffect(() => {
    if (favorite === "true") setIsFav(true);
  }, [favorite]);

  useEffect(() => {
    if (!isAuthenticated || !externalHotelId) {
      return;
    }

    checkIsFavorite({
      external_hotel_id: externalHotelId,
      provider: "rapidapi",
    })
      .then(setIsFav)
      .catch(console.error);
  }, [externalHotelId, isAuthenticated]);
  // Add Fav Hotel to DB
  const submitFavorite = async () => {
    if (!isAuthenticated) {
      router.push(`/signin?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    try {
      await addFavorite({
        external_hotel_id: externalHotelId,
        title: getQueryValue(title) || "Hotel",
        destination: getQueryValue(location) || null,
        image_url: getQueryValue(img) || null,
        provider: "rapidapi",
        metadata: {
          cityId: getQueryValue(cityId),
          description: getQueryValue(description),
          startDate: getQueryValue(startDate),
          endDate: getQueryValue(endDate),
          numOfGuests: getQueryValue(numOfGuests),
          price: getQueryValue(price),
          total: getQueryValue(total),
          star: getQueryValue(star),
          long: getQueryValue(long),
          lat: getQueryValue(lat),
        },
      });
      setIsFav(true);
    } catch (error) {
      console.error(error);
    }
  };
  // Delete Fav Hotel from DB
  const deleteFavorite = async () => {
    if (!isAuthenticated) {
      router.push(`/signin?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    if (!externalHotelId) {
      return;
    }

    try {
      await removeFavorite({
        external_hotel_id: externalHotelId,
        provider: "rapidapi",
      });
      setIsFav(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      {/* No Placeholder for Hotels from Favorite List */}
      <Header
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        placeholder={
          fromFavPage === "false"
            ? `${location} - ${range} - ${numOfGuests}`
            : ``
        }
      />
      <main className="flex flex-col max-w-4xl mx-auto">
        {/* Left Section */}
        <section className="flex-grow pt-14 px-6">
          {fromFavPage === "false" && (
            <h3 className="text-sm font-extralight pb-4 mt-2 mb-6 border-b">
              Hospedagem disponível {range}, {numOfGuests} viajantes
            </h3>
          )}
          <div className="flex justify-between">
            <p className="text-right">{location}</p>
            {/* Favorite Heart Icon */}
            {!isFav ? (
              <HeartIcon
                onClick={submitFavorite}
                className="h-7 cursor-pointer"
              />
            ) : (
              <HeartIconSolid
                onClick={deleteFavorite}
                className="h-7 cursor-pointer text-orange-600"
              />
            )}
          </div>
          <h4 className="text-3xl font-bold">{title}</h4>
          <div className="border-b w-10 pt-2" />
          <div className="flex">
            <p className="pt-2 text-sm text-gray-800 flex-grow">
              {description}
            </p>
            <p className="flex items-center">
              <StarIcon className="h-5 text-red-400" /> {star}
            </p>
          </div>
          {/* Photo Gallery */}
          <CarouselCard images={detailsResult.images.slice(0, 25)} />
          {/* Accommodation Price Details */}
          {fromFavPage === "false" && (
            <>
              <p className="text-right pb-1 text-sm md:text-base">{range}</p>
              <p className="text-right text-md lg:text-xl">
                {numOfGuests} {numOfGuests === "1" ? "Guest" : "Guests"}
              </p>
            </>
          )}
          <p className="text-right text-xl lg:text-2xl font-semibold">
            {`${price} / night`}
          </p>
          {fromFavPage === "false" && (
            <p className="text-right font-extralight">{`$${total} total (tax incl.)`}</p>
          )}
          {/* Button only available for Searched Hotels, and Not From Favorites List */}
          {fromFavPage === "false" && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-right text-sm text-amber-800">
              <p>
                Reservas online estao disponiveis apenas nos pacotes internos.
              </p>
              <Link
                className="mt-3 inline-flex rounded-xl bg-orange-500 px-3 py-1 text-md italic text-white transition duration-250 hover:bg-orange-600 active:scale-95"
                href="/products/lencois-maranhenses-essencial"
              >
                Ver pacotes internos
              </Link>
            </div>
          )}
          {/* Reservation Details */}
          {booking === "true" && (
            <>
              <h3 className="text-2xl font-semibold pt-3 pb-7">
                Booking & Payment details
              </h3>
              <ul className="list-disc pl-5 pb-7">
                <li>
                  Hotel: <span className="font-semibold">{title}</span>
                </li>
                <li>
                  City:{" "}
                  <span className="font-semibold">
                    {(location as string).split("from ")[1]}
                  </span>{" "}
                </li>
                <li>
                  Start date:{" "}
                  <span className="font-semibold"> {startDate}</span>{" "}
                </li>
                <li>
                  End date: <span className="font-semibold"> {endDate}</span>
                </li>
                <li>
                  Price per night<span className="font-semibold"> {price}</span>
                </li>
                <li>
                  Num. of nights:{" "}
                  <span className="font-semibold">
                    {" "}
                    {Math.round(
                      +total! / Number((price! as string).split("$")[1])
                    )}
                  </span>
                </li>
                <li>
                  Total price: <span className="font-semibold"> ${total}</span>
                </li>
              </ul>
              {/* More Hotel Details, Amenities */}
            </>
          )}
          <h3 className="text-2xl font-semibold pb-7">Amenities</h3>
          <ul className="list-disc pl-5">
            {detailsResult.amenities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {/* MapBox, Bottom Section */}
          <h3 className="text-2xl font-semibold py-7">Location</h3>
          <p className="pb-7">{detailsResult.address}</p>
          <div className="w-full h-[500px]">
            <MapCard searchResults={searchResults} />
          </div>
        </section>
      </main>
      <Footer />
      {/* Drawer Menu, closed by default */}
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

export default Details;

export const getServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const { hotelId } = context.query;

  const detailsResult = await getHotelDetails(hotelId).catch(console.error);

  return {
    props: {
      detailsResult,
    },
  };
};
