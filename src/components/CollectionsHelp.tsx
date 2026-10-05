import { ExternalLink } from "lucide-react";
import { getCollectionsSwaggerUrl } from "../utils/url";

/**
 * Explains what "loading collections" means and how to fetch the data from the
 * Collections Service, linking to the current environment's Swagger UI when it
 * can be derived from the simulator's URL.
 */
export default function CollectionsHelp() {
  const swaggerUrl = getCollectionsSwaggerUrl();

  return (
    <div className="space-y-2 text-left">
      <p>
        Collections are the payment transactions the Collections Service
        actually processed for this schedule (collected, rejected, refunded or
        retried). Loading them reconciles each schedule item against what really
        happened, adding a Collections column and correcting the Status/Created
        values.
      </p>
      <p>
        To get them, open the Collections Service Swagger, call the endpoint
        that lists the transactions for this payment schedule ID, and paste or
        upload the JSON array it returns.
      </p>
      {swaggerUrl ? (
        <a
          href={swaggerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline hover:text-primary-dark"
        >
          Open Collections Swagger
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      ) : (
        <p className="italic">
          The Swagger is at this environment's Collections API host (the
          Schedule API host with "-schedule" replaced by "-collections"), under
          /swagger.
        </p>
      )}
    </div>
  );
}
