import { BigDecimal, BigInt, JSONValue, TypedMap, json, log, near } from "@graphprotocol/graph-ts";
import { ZERO_BI } from "./constants";
import {Collection, User} from "../generated/schema";

export function handleNewBlock(block: near.Block): void {
  const header = block.header;
}

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  for (let i = 0; i < actions.length; i++) {
    handleAction(actions[i], receipt);
  }
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ReceiptWithOutcome,
): void {
  if (action.kind != near.ActionKind.FUNCTION_CALL) {
    return;
  }
  const methodName = action.toFunctionCall().methodName;
  const outcome = receipt.outcome;

  for (let logIndex = 0; logIndex < outcome.logs.length; logIndex++) {
    let outcomeLog = outcome.logs[logIndex].toString();
    if (outcomeLog.startsWith('EVENT_JSON:')) {
      outcomeLog = outcomeLog.replace('EVENT_JSON:', '');
      log.warning("Event: {}", [outcomeLog]);

      const jsonData = json.try_fromString(outcomeLog);
      const jsonObject = jsonData.value.toObject();
      const event = jsonObject.get('event')!;
      const dataArr = jsonObject.get('data')!.toArray();
      const dataObj: TypedMap<string, JSONValue> = dataArr[0].toObject();

      handleEvent(methodName, event.toString(), dataObj, receipt);
    }
  }
}

function handleEvent(
  methodName: string,
  event: string,
  data: TypedMap<string, JSONValue>,
  receipt: near.ReceiptWithOutcome
): void {
  if (methodName.toLowerCase() == "launch") {
    const creator_id = data.get("creator_id")!.toString();
    const collection_id = data.get("collection_id")!.toString();
    const name = data.get("name")!.toString();
    const symbol = data.get("symbol")!.toString();
    const price = data.get("mint_price");
    const currency = data.get("mint_currency");
    const base_uri = data.get("base_uri");
    const payment_split_percent = data.get("payment_split_percent");
    const totalSupply = data.get("total_supply");
    
    let collection = Collection.load(collection_id);
    if (collection == null) {
      collection = new Collection(collection_id);
      collection.timestamp = BigInt.fromU64(receipt.block.header.timestampNanosec);
    }
    collection.creator = creator_id;
    collection.name = name;
    collection.symbol = symbol;
    if (totalSupply) {
      collection.totalSupply = totalSupply.toString();
    }

    if (price) {
      collection.price = BigDecimal.fromString(price.toString());
    }
    
    if (currency) {
      collection.currency = currency.toString();
    }
    if (base_uri) {
      collection.base_uri = base_uri.toString();
    }
    if (payment_split_percent) {
      collection.payment_split_percent = payment_split_percent.toString();
    }

    collection.save();

    let user = User.load(creator_id);
    if (user == null) {
      user = new User(creator_id);
    }
    user.name = creator_id;

    user.save();
  }
}