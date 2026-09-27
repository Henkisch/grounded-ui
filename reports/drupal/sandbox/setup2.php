<?php
use Drupal\Core\DrupalKernel;
use Symfony\Component\HttpFoundation\Request;
chdir(__DIR__);
$autoloader = require 'autoload.php';
$request = Request::create('/');
$kernel = DrupalKernel::createFromRequest($request, $autoloader, 'prod');
$kernel->boot();
$kernel->preHandle($request);
$storage = \Drupal::entityTypeManager()->getStorage('contact_form');
if (!$storage->load('feedback')) {
  $storage->create(['id' => 'feedback', 'label' => 'Website feedback', 'recipients' => ['admin@example.com'], 'reply' => '', 'weight' => 0])->save();
}
\Drupal::configFactory()->getEditable('contact.settings')->set('default_form', 'feedback')->save();
$pages = \Drupal::entityTypeManager()->getStorage('search_page');
if (!$pages->load('node_search')) {
  $pages->create(['id' => 'node_search', 'label' => 'Content', 'path' => 'node', 'plugin' => 'node_search', 'weight' => -10])->save();
}
\Drupal::configFactory()->getEditable('search.settings')->set('default_page', 'node_search')->save();
user_role_grant_permissions('anonymous', ['search content', 'administer views']);
drupal_flush_all_caches();
echo "ok\n";
