'use strict';

const { pick, uniq, prop, getOr, flatten, pipe } = require('lodash/fp');
const { getService } = require('../utils');

const getProperties = getOr([], 'properties.locales');
const getFields = prop('properties.fields');

module.exports = {
  async getNonLocalizedAttributes(ctx) {
    const { user } = ctx.state;
    const { model, id, locale } = ctx.request.body;

    const modelDef = strapi.getModel(model);
    const { copyNonLocalizedAttributes, isLocalized } = getService('content-types');
    const { READ_ACTION, CREATE_ACTION } = strapi.admin.services.constants;

    if (!isLocalized(modelDef)) {
      return ctx.badRequest('model.not.localized');
    }

    const entity = await strapi.entityService.findOne({ params: { id } }, { model });

    if (!entity) {
      return ctx.notFound();
    }

    const permissions = await strapi.admin.services.permission.find({
      action_in: [READ_ACTION, CREATE_ACTION],
      subject: model,
      role_in: user.roles.map(prop('id')),
    });

    const localePermissions = permissions
      .filter(perm => getProperties(perm).includes(locale))
      .map(getFields);
    const permittedFields = pipe(flatten, uniq)(localePermissions);

    const nonLocalizedFields = copyNonLocalizedAttributes(modelDef, entity);
    const sanitizedNonLocalizedFields = pick(permittedFields, nonLocalizedFields);

    ctx.body = {
      nonLocalizedFields: sanitizedNonLocalizedFields,
      localizations: entity.localizations.concat(pick(['id', 'locale'], entity)),
    };
  },
};
